import math
from typing import TypedDict


class LabFeatures(TypedDict):
    L: float
    a: float
    b: float


class ClassificationResult(TypedDict):
    season: str
    confidence: float
    scores: dict[str, float]


SEASON_CENTERS: dict[str, LabFeatures] = {
    "spring": {"L": 72, "a": 10, "b": 15},
    "summer": {"L": 68, "a": 0, "b": -5},
    "autumn": {"L": 50, "a": 14, "b": 20},
    "winter": {"L": 35, "a": -5, "b": -8},
}


def classify_season(lab: LabFeatures) -> ClassificationResult:
    distances: dict[str, float] = {}

    for season, center in SEASON_CENTERS.items():
        distance = math.sqrt(
            (lab["L"] - center["L"]) ** 2
            + (lab["a"] - center["a"]) ** 2 * 2
            + (lab["b"] - center["b"]) ** 2 * 2
        )
        distances[season] = distance

    best_season = min(distances, key=distances.get)
    worst_distance = max(distances.values())
    scores = {season: round((worst_distance - distance) / worst_distance, 3) for season, distance in distances.items()}
    total = sum(scores.values())
    confidence = round(scores[best_season] / total, 3) if total > 0 else 0.5

    return {
        "season": best_season,
        "confidence": confidence,
        "scores": scores,
    }
