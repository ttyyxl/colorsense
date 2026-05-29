
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from model_definition import SeasonNet


CLASSES = ["spring", "summer", "autumn", "winter"]

IMG_SIZE = 224

eval_tfms = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def compute_color_features_from_pil(img: Image.Image):
    """
    12维颜色特征：
    Lab mean/std + HSV mean/std，统一除以 255。
    """
    img_rgb = np.array(img.convert("RGB")).astype(np.uint8)

    lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV).astype(np.float32)

    lab_mean = lab.mean(axis=(0, 1))
    lab_std = lab.std(axis=(0, 1))
    hsv_mean = hsv.mean(axis=(0, 1))
    hsv_std = hsv.std(axis=(0, 1))

    feat = np.concatenate([lab_mean, lab_std, hsv_mean, hsv_std]).astype(np.float32)
    feat = feat / 255.0
    return feat


def load_backend_model(model_path, device=None):
    """
    加载训练导出的 best_model.pth。
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    model_path = Path(model_path)
    ckpt = torch.load(model_path, map_location=device)

    model = SeasonNet(
        base_model=ckpt["base_model"],
        num_classes=len(ckpt["classes"]),
        dropout=ckpt.get("dropout", 0.5),
        use_color_features=ckpt.get("use_color_features", True),
        pretrained=False,
    ).to(device)

    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    return model, ckpt, device


def preprocess_pil_for_inference(img: Image.Image, use_color_features=True):
    """
    输入已经裁剪好的人脸 PIL 图，输出图像 tensor 和颜色特征 tensor。
    """
    img = img.convert("RGB")

    x_img = eval_tfms(img).unsqueeze(0)

    if use_color_features:
        color_feat = compute_color_features_from_pil(img)
        x_color = torch.tensor(color_feat, dtype=torch.float32).unsqueeze(0)
    else:
        x_color = torch.zeros((1, 12), dtype=torch.float32)

    return x_img, x_color


def preprocess_for_inference(image_path, use_color_features=True):
    """
    输入已经裁剪好的人脸图，输出图像 tensor 和颜色特征 tensor。
    """
    img = Image.open(image_path).convert("RGB")
    return preprocess_pil_for_inference(img, use_color_features=use_color_features)


def predict_one_crop(image_or_path, model, ckpt, device=None):
    """
    对单张 face crop 进行四季分类。
    返回 predicted_label、confidence、scores、low_confidence。
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    classes = ckpt.get("classes", CLASSES)
    use_color_features = ckpt.get("use_color_features", True)

    if isinstance(image_or_path, Image.Image):
        x_img, x_color = preprocess_pil_for_inference(
            image_or_path,
            use_color_features=use_color_features,
        )
    else:
        x_img, x_color = preprocess_for_inference(
            image_or_path,
            use_color_features=use_color_features,
        )

    x_img = x_img.to(device)
    x_color = x_color.to(device)

    model.eval()
    with torch.no_grad():
        logits = model(x_img, x_color)
        probs = torch.softmax(logits, dim=1).squeeze(0).detach().cpu().numpy()

    pred_idx = int(np.argmax(probs))

    sorted_idx = np.argsort(probs)[::-1]
    top1 = int(sorted_idx[0])
    top2 = int(sorted_idx[1])
    top2_gap = float(probs[top1] - probs[top2])
    confidence = float(probs[pred_idx])

    low_confidence = bool(confidence < 0.45 or top2_gap < 0.08)

    return {
        "predicted_idx": pred_idx,
        "predicted_label": classes[pred_idx],
        "confidence": confidence,
        "top2_gap": top2_gap,
        "low_confidence": low_confidence,
        "scores": {
            classes[i]: float(probs[i])
            for i in range(len(classes))
        },
    }


def load_metadata(metadata_path):
    """
    可选：读取 best_model_metadata.json。
    """
    metadata_path = Path(metadata_path)
    with open(metadata_path, "r", encoding="utf-8") as f:
        return json.load(f)
