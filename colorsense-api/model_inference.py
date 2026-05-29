from functools import lru_cache
from pathlib import Path
from typing import TypedDict

from PIL import Image

from preprocess import load_backend_model, load_metadata, predict_one_crop


class ModelResult(TypedDict):
    season: str
    confidence: float
    scores: dict[str, float]
    source: str
    predicted_label: str
    predicted_idx: int
    top2_gap: float
    low_confidence: bool
    selected_experiment: str | None


MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODELS_DIR / "best_model.pth"
METADATA_PATH = MODELS_DIR / "best_model_metadata.json"


@lru_cache(maxsize=1)
def load_model_bundle():
    model, checkpoint, device = load_backend_model(MODEL_PATH)
    metadata = load_metadata(METADATA_PATH)
    return model, checkpoint, device, metadata


def predict_season(image: Image.Image) -> ModelResult:
    model, checkpoint, device, metadata = load_model_bundle()
    result = predict_one_crop(image, model, checkpoint, device=device)
    predicted_label = str(result["predicted_label"])

    return {
        "season": predicted_label,
        "confidence": float(result["confidence"]),
        "scores": {
            str(label): float(score)
            for label, score in dict(result["scores"]).items()
        },
        "source": "model",
        "predicted_label": predicted_label,
        "predicted_idx": int(result["predicted_idx"]),
        "top2_gap": float(result["top2_gap"]),
        "low_confidence": bool(result["low_confidence"]),
        "selected_experiment": metadata.get("selected_experiment"),
    }
