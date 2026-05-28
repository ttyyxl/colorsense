# ColorSense API for Hugging Face Spaces

This directory is a standalone FastAPI inference backend prepared for Hugging Face Spaces Docker deployment.

## Hugging Face Space Settings

- Space SDK: Docker
- Default port: 7860
- Start command is defined in `Dockerfile`:

```bash
uvicorn main:app --host 0.0.0.0 --port 7860
```

## Files to Upload

Upload the whole `colorsense-api/` directory contents to the Hugging Face Space repository:

```text
Dockerfile
README.md
requirements.txt
main.py
model_inference.py
face_detector.py
color_extractor.py
season_classifier.py
models/best_model.pth
models/label_map.json
models/blaze_face_short_range.tflite
```

`best_model.pth` is the PyTorch season classifier. `blaze_face_short_range.tflite` is required by the MediaPipe face detector.

## API Checks

After deployment, test:

```bash
curl https://YOUR-SPACE-URL.hf.space/health
```

Expected response:

```json
{"status":"ok"}
```

Then test image diagnosis with multipart form field name `image`:

```bash
curl -X POST https://YOUR-SPACE-URL.hf.space/diagnose \
  -F "image=@/path/to/portrait.jpg"
```

Expected successful responses use:

```json
{"source":"model"}
```

Important error behavior:

- No clear face: `422 NO_CLEAR_FACE`
- Model unavailable: `503 MODEL_UNAVAILABLE`
- The production `/diagnose` route does not use rules fallback.

## Frontend Configuration

For the Vercel frontend, set:

```env
NEXT_PUBLIC_API_BASE_URL=https://YOUR-SPACE-URL.hf.space
```

Redeploy or restart the frontend after changing the environment variable.

## Model File Note

Because `models/best_model.pth` is a binary model file, Git LFS is recommended if the Hugging Face repository starts tracking larger or frequently updated model weights.
