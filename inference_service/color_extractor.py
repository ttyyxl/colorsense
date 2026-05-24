import cv2
import numpy as np


def extract_lab_features_from_bgr(bgr_image: np.ndarray) -> dict[str, float]:
    lab_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2LAB)
    pixels = lab_image.reshape(-1, 3).astype(np.float32)

    # Drop very dark and very bright pixels so hair shadows/background highlights
    # have less influence on the first rule-based MVP classifier.
    l_channel = pixels[:, 0]
    mask = (l_channel > 35) & (l_channel < 235)
    filtered = pixels[mask] if mask.any() else pixels

    mean_l, mean_a, mean_b = filtered.mean(axis=0)

    return {
        "L": round(float(mean_l) * 100 / 255, 2),
        "a": round(float(mean_a) - 128, 2),
        "b": round(float(mean_b) - 128, 2),
    }
