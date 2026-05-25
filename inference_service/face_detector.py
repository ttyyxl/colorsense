import cv2
import numpy as np

from color_extractor import extract_lab_features_from_bgr


def _face_detection_class():
    try:
        from mediapipe import solutions

        return solutions.face_detection.FaceDetection
    except (ImportError, AttributeError):
        try:
            from mediapipe.python.solutions.face_detection import FaceDetection

            return FaceDetection
        except (ImportError, AttributeError):
            return None


def _decode_image(image_bytes: bytes) -> np.ndarray | None:
    data = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def detect_face_and_extract_skin(image_bytes: bytes) -> dict[str, object]:
    image = _decode_image(image_bytes)

    if image is None:
        return {
            "success": False,
            "error": "image_decode_failed",
            "lab_mean": None,
            "face_confidence": 0.0,
        }

    height, width = image.shape[:2]
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    face_detection = _face_detection_class()
    if face_detection is None:
        return {
            "success": False,
            "error": "face_detection_unavailable",
            "lab_mean": None,
            "face_confidence": 0.0,
            "face_rgb": None,
        }

    try:
        with face_detection(model_selection=1, min_detection_confidence=0.55) as detector:
            result = detector.process(rgb_image)
    except Exception:
        return {
            "success": False,
            "error": "face_detection_failed",
            "lab_mean": None,
            "face_confidence": 0.0,
            "face_rgb": None,
        }

    if not result.detections:
        return {
            "success": False,
            "error": "face_not_detected",
            "lab_mean": None,
            "face_confidence": 0.0,
            "face_rgb": None,
        }

    detection = max(result.detections, key=lambda item: item.score[0])
    box = detection.location_data.relative_bounding_box
    confidence = float(detection.score[0])

    x1 = max(int(box.xmin * width), 0)
    y1 = max(int(box.ymin * height), 0)
    x2 = min(int((box.xmin + box.width) * width), width)
    y2 = min(int((box.ymin + box.height) * height), height)

    face = image[y1:y2, x1:x2]

    if face.size == 0:
        return {
            "success": False,
            "error": "face_crop_failed",
            "lab_mean": None,
            "face_confidence": confidence,
            "face_rgb": None,
        }

    face_h, face_w = face.shape[:2]

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

    return {
        "success": True,
        "error": None,
        "lab_mean": extract_lab_features_from_bgr(skin_crop),
        "face_confidence": round(confidence, 3),
        "face_rgb": cv2.cvtColor(face, cv2.COLOR_BGR2RGB),
    }
