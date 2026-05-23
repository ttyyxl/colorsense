from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from season_classifier import classify_season


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


@app.post("/diagnose")
def diagnose(features: LabFeatures) -> dict[str, object]:
    if not 0 <= features.L <= 100:
        raise HTTPException(status_code=400, detail="L 明度必须在 0-100 之间")

    result = classify_season(features.model_dump())

    return {
        "season": result["season"],
        "confidence": result["confidence"],
        "scores": result["scores"],
        "lab_features": features.model_dump(),
    }
