from pathlib import Path

import cv2
import numpy as np

from color_extractor import extract_lab_features_from_bgr

MODELS_DIR = Path(__file__).resolve().parent / "models"
FACE_DETECTOR_MODEL_PATH = MODELS_DIR / "blaze_face_short_range.tflite"
CANDIDATE_MIN_DETECTION_CONFIDENCE = 0.55
MIN_FACE_CONFIDENCE = 0.80
MIN_FACE_BOX_SIDE_RATIO = 0.12
MIN_FACE_BOX_AREA_RATIO = 0.03

# Production inference is strict-face-only. Detection failures must propagate
# to /diagnose as 422 NO_CLEAR_FACE and must never fall back to the original
# image for model inference.


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
            min_detection_confidence=CANDIDATE_MIN_DETECTION_CONFIDENCE,
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


def _failed_detection(error: str, confidence: float = 0.0) -> dict[str, object]:
    return {
        "success": False,
        "error": error,
        "lab_mean": None,
        "face_confidence": round(confidence, 3),
        "face_rgb": None,
        "faceDetected": False,
        "usedOriginalImage": True,
    }


def _has_valid_human_face_keypoints(detection, width: int, height: int) -> tuple[bool, str | None]:
    keypoints = getattr(detection, "keypoints", None)
    if not keypoints or len(keypoints) < 4:
        return False, "missing_keypoints"

    # BlazeFace exposes eyes, nose and mouth as its first four normalized
    # keypoints. This is a frontal-face quality gate, not identity validation.
    points = [(float(point.x) * width, float(point.y) * height) for point in keypoints[:4]]
    eye_a, eye_b, nose, mouth = points
    box = detection.bounding_box
    box_x = float(box.origin_x)
    box_y = float(box.origin_y)
    box_w = float(box.width)
    box_h = float(box.height)
    margin_x = box_w * 0.12
    margin_y = box_h * 0.12

    if any(
        x < box_x - margin_x
        or x > box_x + box_w + margin_x
        or y < box_y - margin_y
        or y > box_y + box_h + margin_y
        for x, y in points
    ):
        return False, "keypoints_outside_bbox"

    eye_distance = abs(eye_a[0] - eye_b[0])
    eye_mid_x = (eye_a[0] + eye_b[0]) / 2
    eye_mid_y = (eye_a[1] + eye_b[1]) / 2
    if eye_distance < box_w * 0.18 or eye_distance > box_w * 0.82:
        return False, "invalid_eye_spacing"
    if abs(eye_a[1] - eye_b[1]) > box_h * 0.22:
        return False, "invalid_eye_alignment"
    if abs(nose[0] - eye_mid_x) > eye_distance * 0.65:
        return False, "invalid_nose_alignment"
    if not eye_mid_y < nose[1] < mouth[1]:
        return False, "invalid_feature_order"
    if abs(mouth[0] - eye_mid_x) > box_w * 0.30:
        return False, "invalid_mouth_alignment"

    return True, None


def detect_face_and_extract_skin(image_bytes: bytes) -> dict[str, object]:
    image = _decode_image(image_bytes)

    if image is None:
        _trace("Face detection failed: image_decode_failed")
        return _failed_detection("image_decode_failed")

    height, width = image.shape[:2]
    rgb_image = np.ascontiguousarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    _trace(f"Input decoded format=BGR shape={image.shape} dtype={image.dtype}")
    _trace(f"MediaPipe input format=RGB shape={rgb_image.shape} dtype={rgb_image.dtype}")

    detector, mp, detector_error = _create_face_detector()
    if detector is None or mp is None:
        return _failed_detection(detector_error or "face_detection_unavailable")

    try:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        result = detector.detect(mp_image)
    except Exception as exc:
        _trace(f"Face detection failed: mediapipe_exception exception={type(exc).__name__}: {exc}")
        return _failed_detection("mediapipe_exception")
    finally:
        detector.close()

    detections = result.detections
    _trace(f"detection count={len(detections)}")
    if not detections:
        _trace("Face detection failed: no_detection")
        return _failed_detection("no_detection")

    for index, item in enumerate(detections):
        score = float(item.categories[0].score) if item.categories else 0.0
        _trace(f"detection[{index}] confidence={score:.6f}")

    detection = max(detections, key=lambda item: float(item.categories[0].score) if item.categories else 0.0)
    box = detection.bounding_box
    confidence = float(detection.categories[0].score) if detection.categories else 0.0
    if confidence < MIN_FACE_CONFIDENCE:
        _trace(f"Face detection rejected: low_confidence confidence={confidence:.6f} minimum={MIN_FACE_CONFIDENCE:.2f}")
        return _failed_detection("low_confidence", confidence)

    if len(detections) != 1:
        _trace(f"Face detection rejected: multiple_faces count={len(detections)}")
        return _failed_detection("multiple_faces", confidence)

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
        return _failed_detection("invalid_bbox", confidence)

    box_width_ratio = (x2 - x1) / width
    box_height_ratio = (y2 - y1) / height
    box_area_ratio = box_width_ratio * box_height_ratio
    if (
        box_width_ratio < MIN_FACE_BOX_SIDE_RATIO
        or box_height_ratio < MIN_FACE_BOX_SIDE_RATIO
        or box_area_ratio < MIN_FACE_BOX_AREA_RATIO
    ):
        _trace(
            "Face detection rejected: face_too_small "
            f"width_ratio={box_width_ratio:.4f} height_ratio={box_height_ratio:.4f} area_ratio={box_area_ratio:.4f}"
        )
        return _failed_detection("face_too_small", confidence)

    has_human_landmarks, landmark_error = _has_valid_human_face_keypoints(detection, width, height)
    if not has_human_landmarks:
        _trace(f"Face detection rejected: {landmark_error}")
        return _failed_detection(landmark_error or "invalid_keypoints", confidence)

    face = image[y1:y2, x1:x2]

    if face.size == 0 or face.shape[0] < 16 or face.shape[1] < 16:
        _trace(f"Face detection failed: crop_too_small face_crop_shape={face.shape}")
        return _failed_detection("crop_too_small", confidence)

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
