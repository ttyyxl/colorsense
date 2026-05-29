import io
import logging
import os
import traceback
from time import perf_counter

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

from face_detector import MIN_FACE_CONFIDENCE, detect_face_and_extract_skin
from season_classifier import classify_season

logger = logging.getLogger(__name__)


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

allowed_origins = ["http://localhost:3000"]
frontend_origin = os.getenv("FRONTEND_ORIGIN", "").rstrip("/")
if frontend_origin and frontend_origin not in allowed_origins:
    allowed_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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
        original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        original_image.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="图片无法读取，请上传有效图片")

    _trace(f"Pillow decoded image.size={original_image.size} image.mode={original_image.mode}")
    original_bgr = np.asarray(original_image)[:, :, ::-1].copy()
    _trace(f"Numpy image shape={original_bgr.shape} format=BGR dtype={original_bgr.dtype}")
    _trace("Entering face detection with encoded upload; detector decodes BGR and converts input to RGB for MediaPipe.")
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
        if face_error == "low_confidence" or (
            face_result.get("success") is True and face_confidence < MIN_FACE_CONFIDENCE
        ):
            _trace("Face confidence too low; aborting diagnosis.")
            _trace(f"face_confidence={face_confidence:.3f} minimum_required={MIN_FACE_CONFIDENCE:.2f}")
        elif face_error in {
            "multiple_faces",
            "face_too_small",
            "missing_keypoints",
            "keypoints_outside_bbox",
            "invalid_eye_spacing",
            "invalid_eye_alignment",
            "invalid_nose_alignment",
            "invalid_feature_order",
            "invalid_mouth_alignment",
            "invalid_keypoints",
        }:
            _trace("Human face validation failed; aborting diagnosis.")
            _trace(f"validation_error={face_error}")
        _trace("No clear face detected; aborting diagnosis.")
        _trace("Returning 422 NO_CLEAR_FACE.")
        return JSONResponse(
            status_code=422,
            content={
                "error": "NO_CLEAR_FACE",
                "message": "未检测到清晰人脸，请在自然光下上传正面人像照片后重试。",
                "quality": {
                    "faceDetected": False,
                    "usedOriginalImage": True,
                    "faceConfidence": face_confidence,
                },
            },
        )

    lab_features = face_result["lab_mean"]
    model_image = Image.fromarray(face_crop)
    face_detected = True
    used_original_image = False

    try:
        from model_inference import predict_season

        _trace(f"Model input source=face crop size={model_image.size} faceDetected={face_detected} usedOriginalImage={used_original_image}")
        inference_started_at = perf_counter()
        result = predict_season(model_image)
        logger.info(
            "Model inference completed source=%s duration_ms=%.1f.",
            result["source"],
            (perf_counter() - inference_started_at) * 1000,
        )
    except Exception as exc:
        _trace("Model inference failed; aborting diagnosis without rules fallback.")
        _trace(f"exception type={type(exc).__name__} exception message={exc}")
        traceback.print_exc()
        return JSONResponse(status_code=503, content=MODEL_UNAVAILABLE_RESPONSE)

    if result.get("source") != "model":
        _trace(f"Model returned non-model source={result.get('source')!r}; aborting diagnosis.")
        return JSONResponse(status_code=503, content=MODEL_UNAVAILABLE_RESPONSE)

    response = {
        "season": result["season"],
        "confidence": result["confidence"],
        "scores": result["scores"],
        "source": result["source"],
        "lab_features": lab_features,
        "face_confidence": face_confidence,
        "faceDetected": face_detected,
        "usedOriginalImage": used_original_image,
    }
    _trace(
        f"Diagnosis response source={result['source']} faceDetected={face_detected} "
        f"usedOriginalImage={used_original_image} face_confidence={face_confidence}"
    )
    logger.info(
        "Diagnosis request completed source=%s duration_ms=%.1f.",
        result["source"],
        (perf_counter() - request_started_at) * 1000,
    )
    return response
