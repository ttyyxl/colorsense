def detect_face_and_extract_skin(_image_bytes: bytes) -> dict[str, object]:
    return {
        "success": False,
        "error": "face_detector_not_implemented",
        "lab_mean": None,
        "face_confidence": 0.0,
    }
