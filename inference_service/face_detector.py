from pathlib import Path

import cv2
import numpy as np

from color_extractor import extract_lab_features_from_bgr

MODELS_DIR = Path(__file__).resolve().parent / "models"
FACE_DETECTOR_MODEL_PATH = MODELS_DIR / "blaze_face_short_range.tflite"


def _trace(message: str) -> None:
    print(f"[face-detection] {message}", flush=True)


def _create_face_detector():
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        _trace(f"MediaPipe import succeeded version={getattr(mp, '__version__', 'unknown')} api=tasks")
    except (ImportError, AttributeError) as exc:
        _trace(f"MediaPipe import failed exception={type(exc).__name__}: {exc}")
        return None, None, "face_detection_unavailable"

    if not FACE_DETECTOR_MODEL_PATH.exists():
        _trace(f"Face detector model missing path={FACE_DETECTOR_MODEL_PATH}")
        return None, None, "detector_model_missing"

    try:
        options = vision.FaceDetectorOptions(
            base_options=mp_python.BaseOptions(model_asset_buffer=FACE_DETECTOR_MODEL_PATH.read_bytes()),
            min_detection_confidence=0.55,
        )
        detector = vision.FaceDetector.create_from_options(options)
        _trace(f"FaceDetection initialization succeeded model_buffer_path={FACE_DETECTOR_MODEL_PATH}")
        return detector, mp, None
    except Exception as exc:
        _trace(f"FaceDetection initialization failed exception={type(exc).__name__}: {exc}")
        return None, None, "mediapipe_exception"


def _decode_image(image_bytes: bytes) -> np.ndarray | None:
    data = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def detect_face_and_extract_skin(image_bytes: bytes) -> dict[str, object]:
    image = _decode_image(image_bytes)

    if image is None:
        _trace("Face detection failed: image_decode_failed")
        return {
            "success": False,
            "error": "image_decode_failed",
            "lab_mean": None,
            "face_confidence": 0.0,
            "face_rgb": None,
            "faceDetected": False,
            "usedOriginalImage": True,
        }

    height, width = image.shape[:2]
    rgb_image = np.ascontiguousarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    _trace(f"Input decoded format=BGR shape={image.shape} dtype={image.dtype}")
    _trace(f"MediaPipe input format=RGB shape={rgb_image.shape} dtype={rgb_image.dtype}")

    detector, mp, detector_error = _create_face_detector()
    if detector is None or mp is None:
        return {
            "success": False,
            "error": detector_error,
            "lab_mean": None,
            "face_confidence": 0.0,
            "face_rgb": None,
            "faceDetected": False,
            "usedOriginalImage": True,
        }

    try:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        result = detector.detect(mp_image)
    except Exception as exc:
        _trace(f"Face detection failed: mediapipe_exception exception={type(exc).__name__}: {exc}")
        return {
            "success": False,
            "error": "mediapipe_exception",
            "lab_mean": None,
            "face_confidence": 0.0,
            "face_rgb": None,
            "faceDetected": False,
            "usedOriginalImage": True,
        }
    finally:
        detector.close()

    detections = result.detections
    _trace(f"detection count={len(detections)}")
    if not detections:
        _trace("Face detection failed: no_detection")
        return {
            "success": False,
            "error": "no_detection",
            "lab_mean": None,
            "face_confidence": 0.0,
            "face_rgb": None,
            "faceDetected": False,
            "usedOriginalImage": True,
        }

    for index, item in enumerate(detections):
        score = float(item.categories[0].score) if item.categories else 0.0
        _trace(f"detection[{index}] confidence={score:.6f}")

    detection = max(detections, key=lambda item: float(item.categories[0].score) if item.categories else 0.0)
    box = detection.bounding_box
    confidence = float(detection.categories[0].score) if detection.categories else 0.0
    raw_x1 = int(box.origin_x)
    raw_y1 = int(box.origin_y)
    raw_x2 = raw_x1 + int(box.width)
    raw_y2 = raw_y1 + int(box.height)
    relative_box = (
        raw_x1 / width,
        raw_y1 / height,
        (raw_x2 - raw_x1) / width,
        (raw_y2 - raw_y1) / height,
    )
    x1 = max(raw_x1, 0)
    y1 = max(raw_y1, 0)
    x2 = min(raw_x2, width)
    y2 = min(raw_y2, height)
    was_clamped = (x1, y1, x2, y2) != (raw_x1, raw_y1, raw_x2, raw_y2)
    _trace(
        "bounding box relative=(x=%.4f, y=%.4f, width=%.4f, height=%.4f) "
        "raw_pixels=(%d, %d, %d, %d)"
        % (*relative_box, raw_x1, raw_y1, raw_x2, raw_y2)
    )
    _trace(f"crop box pixels=({x1}, {y1}, {x2}, {y2}) clamped={was_clamped}")

    if x2 <= x1 or y2 <= y1:
        _trace("Face detection failed: invalid_bbox")
        return {
            "success": False,
            "error": "invalid_bbox",
            "lab_mean": None,
            "face_confidence": confidence,
            "face_rgb": None,
            "faceDetected": False,
            "usedOriginalImage": True,
        }

    face = image[y1:y2, x1:x2]

    if face.size == 0 or face.shape[0] < 16 or face.shape[1] < 16:
        _trace(f"Face detection failed: crop_too_small face_crop_shape={face.shape}")
        return {
            "success": False,
            "error": "crop_too_small",
            "lab_mean": None,
            "face_confidence": confidence,
            "face_rgb": None,
            "faceDetected": False,
            "usedOriginalImage": True,
        }

    face_h, face_w = face.shape[:2]
    _trace(f"face crop shape={face.shape}")

    # Approximate cheek/skin area for MVP: central-lower face, avoiding hair,
    # eyes, mouth edges, and background. This is intentionally replaceable by
    # FACER/FaRL masks later.
    sx1 = int(face_w * 0.25)
    sx2 = int(face_w * 0.75)
    sy1 = int(face_h * 0.38)
    sy2 = int(face_h * 0.72)
    skin_crop = face[sy1:sy2, sx1:sx2]

    if skin_crop.size == 0:
        skin_crop = face

    _trace(f"Using face crop for model inference confidence={confidence:.6f}")
    return {
        "success": True,
        "error": None,
        "lab_mean": extract_lab_features_from_bgr(skin_crop),
        "face_confidence": round(confidence, 3),
        "face_rgb": cv2.cvtColor(face, cv2.COLOR_BGR2RGB),
        "faceDetected": True,
        "usedOriginalImage": False,
    }
