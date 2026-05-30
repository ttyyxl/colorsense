import io
import json
import logging
import os
import traceback
from functools import lru_cache
from pathlib import Path
from time import perf_counter

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel

from face_detector import FACE_DETECTOR_MODEL_PATH, MIN_FACE_CONFIDENCE, detect_face_and_extract_skin
from preprocess import load_backend_model, load_metadata, predict_one_crop
from season_classifier import classify_season

logger = logging.getLogger(__name__)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "best_model.pth"
METADATA_PATH = MODELS_DIR / "best_model_metadata.json"
LOW_CONFIDENCE_WARNING = "结果置信度较低，建议上传自然光下的正面清晰人像照片重新诊断。"
NO_CLEAR_FACE_MESSAGE = "未检测到清晰人脸，请在自然光下重新上传或拍摄正面人像照片。"


def _trace(message: str) -> None:
    print(f"[diagnose] {message}", flush=True)


class LabFeatures(BaseModel):
    L: float
    a: float
    b: float


MODEL_UNAVAILABLE_RESPONSE = {
    "success": False,
    "error": "MODEL_UNAVAILABLE",
    "code": "MODEL_UNAVAILABLE",
    "message": "模型服务暂时不可用，请稍后重试。",
}


app = FastAPI(title="ColorSense Inference Service")


def _parse_allowed_origins() -> list[str]:
    defaults = ["http://localhost:3000", "http://127.0.0.1:3000"]
    configured = os.getenv("FRONTEND_ORIGIN", "")
    origins = [
        origin.strip().rstrip("/")
        for origin in configured.split(",")
        if origin.strip()
    ]
    return list(dict.fromkeys([*defaults, *origins]))


allowed_origins = _parse_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, object]:
    metadata = _read_model_metadata()
    model_state = _get_model_state()
    return {
        "status": "ok" if model_state["modelLoaded"] and FACE_DETECTOR_MODEL_PATH.exists() else "degraded",
        "modelReady": MODEL_PATH.exists() and METADATA_PATH.exists(),
        "faceDetectorReady": FACE_DETECTOR_MODEL_PATH.exists(),
        "modelLoaded": model_state["modelLoaded"],
        "modelError": model_state["modelError"],
        "modelPath": str(MODEL_PATH),
        "metadataPath": str(METADATA_PATH),
        "faceDetectorPath": str(FACE_DETECTOR_MODEL_PATH),
        "selected_experiment": metadata.get("selected_experiment"),
        "base_model": metadata.get("selected_metrics", {}).get("base_model"),
        "use_color_features": metadata.get("selected_metrics", {}).get("use_color_features"),
        "classes": metadata.get("classes"),
        "confidence_policy": metadata.get("confidence_policy"),
        "corsAllowedOrigins": allowed_origins,
    }


@app.post("/diagnose-lab")
def diagnose_lab(features: LabFeatures) -> dict[str, object]:
    if not 0 <= features.L <= 100:
        raise HTTPException(status_code=400, detail="L 明度必须在 0-100 之间")

    result = classify_season(features.model_dump())
    return {
        "season": result["season"],
        "confidence": result["confidence"],
        "scores": result["scores"],
        "lab_features": features.model_dump(),
        "source": "rules",
    }


def _read_model_metadata() -> dict[str, object]:
    if not METADATA_PATH.exists():
        return {}
    try:
        return load_metadata(METADATA_PATH)
    except (OSError, json.JSONDecodeError) as exc:
        _trace(f"Model metadata read failed type={type(exc).__name__} message={exc}")
        return {}


@lru_cache(maxsize=1)
def _load_model_bundle():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    if not METADATA_PATH.exists():
        raise FileNotFoundError(f"Model metadata file not found: {METADATA_PATH}")
    model, ckpt, device = load_backend_model(MODEL_PATH)
    metadata = load_metadata(METADATA_PATH)
    return model, ckpt, device, metadata


def _get_model_state() -> dict[str, object]:
    try:
        model, ckpt, device, metadata = _load_model_bundle()
        return {
            "modelLoaded": model is not None,
            "modelError": None,
            "device": str(device),
            "checkpointBaseModel": ckpt.get("base_model"),
            "checkpointUseColorFeatures": ckpt.get("use_color_features"),
            "selectedExperiment": metadata.get("selected_experiment"),
        }
    except Exception as exc:
        return {
            "modelLoaded": False,
            "modelError": f"{type(exc).__name__}: {exc}",
            "device": None,
            "checkpointBaseModel": None,
            "checkpointUseColorFeatures": None,
            "selectedExperiment": None,
        }


def _low_confidence_warning(metadata: dict[str, object]) -> str:
    policy = metadata.get("confidence_policy")
    if isinstance(policy, dict) and isinstance(policy.get("message"), str):
        return policy["message"]
    return LOW_CONFIDENCE_WARNING


@app.post("/diagnose", response_model=None)
async def diagnose(image: UploadFile = File(...)) -> dict[str, object] | JSONResponse:
    request_started_at = perf_counter()
    _trace(f"Upload received filename={image.filename!r} content_type={image.content_type!r}")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}:
        raise HTTPException(status_code=400, detail="仅支持 JPG、PNG、HEIC 或 WebP 图片")

    image_bytes = await image.read()
    _trace(f"Upload bytes size={len(image_bytes)}")

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片不能超过 10MB")

    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        original_mode = pil_image.mode
        original_size = pil_image.size
        transposed_image = ImageOps.exif_transpose(pil_image)
        exif_transposed = transposed_image.size != original_size or transposed_image.mode != original_mode
        original_image = transposed_image.convert("RGB")
        rgb_converted = original_image.mode != transposed_image.mode
        original_image.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="图片无法读取，请上传有效图片")

    _trace(
        "Pillow decoded "
        f"original_mode={original_mode} original_size={original_size} "
        f"exif_transpose_applied={exif_transposed} "
        f"rgb_conversion_applied={rgb_converted} "
        f"final_mode={original_image.mode} final_size={original_image.size}"
    )
    original_rgb = np.asarray(original_image)
    _trace(f"Numpy image shape={original_rgb.shape} format=RGB dtype={original_rgb.dtype}")

    try:
        face_result = detect_face_and_extract_skin(image_bytes)
    except Exception as exc:
        _trace("Face detection failed: mediapipe_exception.")
        _trace(f"exception type={type(exc).__name__} exception message={exc}")
        traceback.print_exc()
        face_result = {
            "success": False,
            "face_confidence": 0.0,
            "face_rgb": None,
            "faceDetected": False,
            "usedOriginalImage": True,
        }

    face_confidence = float(face_result.get("face_confidence") or 0.0)
    face_crop = face_result.get("face_rgb")
    face_error = face_result.get("error")
    has_valid_face_crop = isinstance(face_crop, np.ndarray) and face_crop.size > 0
    has_clear_face = (
        face_result.get("success") is True
        and face_result.get("faceDetected") is True
        and face_result.get("usedOriginalImage") is False
        and face_confidence >= MIN_FACE_CONFIDENCE
        and has_valid_face_crop
    )

    if not has_clear_face:
        _trace(
            "Face gate failed "
            f"face_error={face_error!r} faceDetected={face_result.get('faceDetected')} "
            f"usedOriginalImage={face_result.get('usedOriginalImage')} "
            f"has_valid_face_crop={has_valid_face_crop} "
            f"face_confidence={face_confidence:.3f} minimum_required={MIN_FACE_CONFIDENCE:.2f}"
        )
        _trace("No clear face detected; aborting diagnosis.")
        return JSONResponse(
            status_code=422,
            content={
                "error": "NO_CLEAR_FACE",
                "message": NO_CLEAR_FACE_MESSAGE,
                "quality": {
                    "faceDetected": bool(face_result.get("faceDetected") is True),
                    "usedOriginalImage": bool(face_result.get("usedOriginalImage") is not False),
                    "faceConfidence": face_confidence,
                },
            },
        )

    lab_features = face_result["lab_mean"]
    model_image = Image.fromarray(face_crop)
    face_detected = True
    used_original_image = False

    try:
        model, ckpt, device, metadata = _load_model_bundle()
        _trace(
            "Model input source=face crop "
            f"size={model_image.size} faceDetected={face_detected} "
            f"usedOriginalImage={used_original_image} "
            f"selected_experiment={metadata.get('selected_experiment')}"
        )
        inference_started_at = perf_counter()
        result = predict_one_crop(model_image, model, ckpt, device=device)
        logger.info(
            "Model inference completed predicted_label=%s confidence=%.4f duration_ms=%.1f.",
            result["predicted_label"],
            result["confidence"],
            (perf_counter() - inference_started_at) * 1000,
        )
    except Exception as exc:
        _trace("Model inference failed; aborting diagnosis without rules fallback.")
        _trace(f"exception type={type(exc).__name__} exception message={exc}")
        traceback.print_exc()
        return JSONResponse(status_code=503, content=MODEL_UNAVAILABLE_RESPONSE)

    season = str(result["predicted_label"])
    confidence = float(result["confidence"])
    scores = {
        str(label): round(float(score), 6)
        for label, score in dict(result["scores"]).items()
    }
    low_confidence = bool(result.get("low_confidence"))

    response = {
        "season": season,
        "confidence": round(confidence, 6),
        "scores": scores,
        "source": "model",
        "lab_features": lab_features,
        "face_confidence": face_confidence,
        "faceDetected": face_detected,
        "usedOriginalImage": used_original_image,
        "predicted_label": season,
        "predicted_idx": int(result["predicted_idx"]),
        "top2_gap": round(float(result["top2_gap"]), 6),
        "low_confidence": low_confidence,
        "model_version": metadata.get("selected_metrics", {}).get("best_epoch"),
        "selected_experiment": metadata.get("selected_experiment"),
        "base_model": metadata.get("selected_metrics", {}).get("base_model", ckpt.get("base_model")),
        "use_color_features": metadata.get("selected_metrics", {}).get("use_color_features", ckpt.get("use_color_features")),
    }
    if low_confidence:
        response["warning"] = _low_confidence_warning(metadata)

    _trace(
        f"Diagnosis response source=model predicted_label={season} "
        f"confidence={confidence:.4f} top2_gap={float(result['top2_gap']):.4f} "
        f"low_confidence={low_confidence} faceDetected={face_detected} "
        f"usedOriginalImage={used_original_image} face_confidence={face_confidence}"
    )
    logger.info(
        "Diagnosis request completed source=%s duration_ms=%.1f.",
        "model",
        (perf_counter() - request_started_at) * 1000,
    )
    return response
