import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import TypedDict

import torch
from PIL import Image
from torch import nn
from torchvision.models import efficientnet_b0
from torchvision.transforms import Compose, Normalize, Resize, ToTensor

logger = logging.getLogger(__name__)


def _trace(message: str) -> None:
    print(f"[model-inference] {message}", flush=True)


class ModelResult(TypedDict):
    season: str
    confidence: float
    scores: dict[str, float]
    source: str


MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODELS_DIR / "best_model.pth"
LABEL_MAP_PATH = MODELS_DIR / "label_map.json"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

PREPROCESS = Compose(
    [
        Resize((224, 224)),
        ToTensor(),
        Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


@lru_cache(maxsize=1)
def load_model() -> tuple[nn.Module, dict[str, str]]:
    _trace(f"Model file path={MODEL_PATH} exists={MODEL_PATH.exists()}")
    _trace(f"Label map path={LABEL_MAP_PATH} exists={LABEL_MAP_PATH.exists()}")
    with LABEL_MAP_PATH.open("r", encoding="utf-8") as file:
        raw_label_map = json.load(file)

    if not isinstance(raw_label_map, dict):
        raise ValueError("label_map.json must be a JSON object.")

    _trace(f"raw_label_map keys={list(raw_label_map.keys())}")
    label_map_source = raw_label_map.get("idx_to_class", raw_label_map)
    if not isinstance(label_map_source, dict):
        raise ValueError("label_map.json must contain an 'idx_to_class' object or a flat index-to-label object.")

    label_map = {str(index): str(label) for index, label in label_map_source.items()}

    model = efficientnet_b0(weights=None)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, 4)

    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
    state_dict = checkpoint["model_state_dict"] if "model_state_dict" in checkpoint else checkpoint
    model.load_state_dict(state_dict)

    num_outputs = model.classifier[1].out_features
    missing_indices = [str(index) for index in range(num_outputs) if str(index) not in label_map]
    if missing_indices:
        raise ValueError(f"label_map.json is missing model output indices: {missing_indices}.")

    model.to(DEVICE)
    model.eval()

    logger.info("Loaded label_map: %s", label_map)
    _trace(f"Loaded label_map: {label_map}")
    _trace(f"Model loaded successfully device={DEVICE}")
    return model, label_map


def predict_season(image: Image.Image) -> ModelResult:
    model, label_map = load_model()
    _trace(f"Final image input size={image.size} mode={image.mode}")
    tensor = PREPROCESS(image.convert("RGB")).unsqueeze(0).to(DEVICE)
    _trace(f"Preprocessed tensor shape={tuple(tensor.shape)} device={tensor.device}")

    with torch.inference_mode():
        probabilities = torch.softmax(model(tensor), dim=1)[0].cpu().tolist()

    unmapped_indices = [str(index) for index in range(len(probabilities)) if str(index) not in label_map]
    if unmapped_indices:
        raise ValueError(f"Missing predicted index {unmapped_indices[0]} in label_map keys: {sorted(label_map.keys())}.")

    scores = {
        label_map[str(index)]: round(float(probability), 6)
        for index, probability in enumerate(probabilities)
    }
    best_index = max(range(len(probabilities)), key=probabilities.__getitem__)
    season = label_map[str(best_index)]
    confidence = round(float(probabilities[best_index]), 6)
    logger.info("Model prediction predicted_idx=%s predicted_label=%s source=model.", best_index, season)
    _trace(
        f"Model prediction predicted_idx={best_index} predicted_label={season} "
        f"confidence={confidence} scores={scores} source=model"
    )

    return {
        "season": season,
        "confidence": confidence,
        "scores": scores,
        "source": "model",
    }
