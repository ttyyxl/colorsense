import io
import logging
from time import perf_counter

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

from color_extractor import extract_lab_features_from_bgr
from face_detector import detect_face_and_extract_skin
from season_classifier import classify_season

logger = logging.getLogger(__name__)


class LabFeatures(BaseModel):
    L: float
    a: float
    b: float


app = FastAPI(title="ColorSense Inference Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.post("/diagnose")
async def diagnose(image: UploadFile = File(...)) -> dict[str, object]:
    request_started_at = perf_counter()
    if image.content_type not in {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}:
        raise HTTPException(status_code=400, detail="仅支持 JPG、PNG、HEIC 或 WebP 图片")

    image_bytes = await image.read()

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片不能超过 10MB")

    try:
        original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        original_image.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="图片无法读取，请上传有效图片")

    original_bgr = np.asarray(original_image)[:, :, ::-1].copy()
    lab_features = extract_lab_features_from_bgr(original_bgr)
    face_confidence = 0.0
    model_image = original_image

    try:
        face_result = detect_face_and_extract_skin(image_bytes)
        if face_result["success"]:
            lab_features = face_result["lab_mean"]
            face_confidence = face_result["face_confidence"]
            model_image = Image.fromarray(face_result["face_rgb"])
        else:
            logger.warning(
                "Face detection unavailable or unsuccessful (%s); using original image for model inference.",
                face_result["error"],
            )
    except Exception:
        logger.warning(
            "Face detection failed unexpectedly; using original image for model inference.",
            exc_info=True,
        )

    try:
        from model_inference import predict_season

        inference_started_at = perf_counter()
        result = predict_season(model_image)
        logger.info(
            "Model inference completed source=%s duration_ms=%.1f.",
            result["source"],
            (perf_counter() - inference_started_at) * 1000,
        )
    except Exception:
        logger.warning("Model inference failed; falling back to LAB rules.", exc_info=True)
        result = {
            **classify_season(lab_features),
            "source": "rules",
        }

    response = {
        "season": result["season"],
        "confidence": result["confidence"],
        "scores": result["scores"],
        "source": result["source"],
        "lab_features": lab_features,
        "face_confidence": face_confidence,
    }
    logger.info(
        "Diagnosis request completed source=%s duration_ms=%.1f.",
        result["source"],
        (perf_counter() - request_started_at) * 1000,
    )
    return response
