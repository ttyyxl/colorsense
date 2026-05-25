import json
from functools import lru_cache
from pathlib import Path
from typing import TypedDict

import torch
from PIL import Image
from torch import nn
from torchvision.models import efficientnet_b0
from torchvision.transforms import Compose, Normalize, Resize, ToTensor


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
    with LABEL_MAP_PATH.open("r", encoding="utf-8") as file:
        label_map = json.load(file)

    model = efficientnet_b0(weights=None)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, 4)

    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
    state_dict = checkpoint["model_state_dict"] if "model_state_dict" in checkpoint else checkpoint
    model.load_state_dict(state_dict)
    model.to(DEVICE)
    model.eval()

    return model, {str(index): str(label) for index, label in label_map.items()}


def predict_season(image: Image.Image) -> ModelResult:
    model, label_map = load_model()
    tensor = PREPROCESS(image.convert("RGB")).unsqueeze(0).to(DEVICE)

    with torch.inference_mode():
        probabilities = torch.softmax(model(tensor), dim=1)[0].cpu().tolist()

    scores = {
        label_map[str(index)]: round(float(probability), 6)
        for index, probability in enumerate(probabilities)
    }
    best_index = max(range(len(probabilities)), key=probabilities.__getitem__)
    season = label_map[str(best_index)]

    return {
        "season": season,
        "confidence": round(float(probabilities[best_index]), 6),
        "scores": scores,
        "source": "model",
    }
