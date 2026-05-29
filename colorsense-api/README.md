# ColorSense API

Standalone FastAPI inference backend for local development and Hugging Face Spaces Docker deployment.

## Runtime

Recommended Python version:

```text
Python 3.10 or 3.11
```

MediaPipe may not provide wheels for newer Python versions such as Python 3.13. If dependency installation fails locally, create a Python 3.10/3.11 virtual environment.

## Local Setup

From the repository root:

```bash
cd colorsense-api
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Optional local environment file:

```bash
copy .env.example .env
```

Start the API locally:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Configure the Next.js frontend `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Required Model Files

The backend expects these files:

```text
colorsense-api/models/best_model.pth
colorsense-api/models/best_model_metadata.json
colorsense-api/models/blaze_face_short_range.tflite
```

`best_model.pth` is the EfficientNet-B0 + Lab/HSV color-feature season classifier. `best_model_metadata.json` records selected experiment, class order, and confidence policy. `blaze_face_short_range.tflite` is required by the MediaPipe face detector.

## API

Health check:

```bash
curl http://localhost:8000/health
```

Expected response includes model readiness:

```json
{
  "status": "ok",
  "modelReady": true,
  "faceDetectorReady": true
}
```

Image diagnosis:

```bash
curl -X POST http://localhost:8000/diagnose ^
  -F "image=@C:\path\to\portrait.jpg"
```

Successful response shape:

```json
{
  "season": "summer",
  "confidence": 0.91,
  "scores": {
    "spring": 0.01,
    "summer": 0.91,
    "autumn": 0.03,
    "winter": 0.05
  },
  "source": "model",
  "lab_features": {
    "L": 65.1,
    "a": 8.2,
    "b": 12.3
  },
  "face_confidence": 0.93,
  "faceDetected": true,
  "usedOriginalImage": false,
  "predicted_label": "summer",
  "predicted_idx": 1,
  "top2_gap": 0.21,
  "low_confidence": false,
  "selected_experiment": "efficientnet_b0_color",
  "base_model": "efficientnet_b0",
  "use_color_features": true
}
```

Important error behavior:

```text
422 NO_CLEAR_FACE
503 MODEL_UNAVAILABLE
```

The production `/diagnose` route is strict-face-only. If a clear single face is not detected, diagnosis is aborted and the backend does not fall back to the original image.

## CORS

Default allowed origins:

```text
http://localhost:3000
http://127.0.0.1:3000
```

Add more origins with comma-separated `FRONTEND_ORIGIN`:

```env
FRONTEND_ORIGIN=http://localhost:3000,https://your-site.vercel.app
```

## Hugging Face Space

Space SDK:

```text
Docker
```

The Dockerfile starts:

```bash
uvicorn main:app --host 0.0.0.0 --port 7860
```

Upload the contents of `colorsense-api/` to the Hugging Face Space repository when you are ready. This assistant does not run Hugging Face upload or deployment commands.

Minimum upload list:

```text
Dockerfile
README.md
requirements.txt
.env.example
main.py
model_definition.py
preprocess.py
face_detector.py
color_extractor.py
season_classifier.py
models/best_model.pth
models/best_model_metadata.json
models/blaze_face_short_range.tflite
```

Do not upload local virtual environments, cache folders, real `.env` files, API tokens, service account JSON files, logs, or temporary test files.
