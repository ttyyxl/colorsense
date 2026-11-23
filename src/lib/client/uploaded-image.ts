"use client";

/**
 * 诊断记录本身不落库保存用户上传的原图，这里把（压缩后的）原图按诊断 ID
 * 暂存在浏览器本地，供结果页生成形象图卡时作为图生图参考图使用。
 */
const UPLOADED_IMAGE_PREFIX = "colorsense:uploaded-image:";

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;

export function saveUploadedImage(diagnosisId: string, dataUrl: string): void {
  try {
    localStorage.setItem(UPLOADED_IMAGE_PREFIX + diagnosisId, dataUrl);
  } catch {
    /* 本地存储写入失败时静默降级为纯文生图 */
  }
}

export function readUploadedImage(diagnosisId: string): string | null {
  try {
    return localStorage.getItem(UPLOADED_IMAGE_PREFIX + diagnosisId);
  } catch {
    return null;
  }
}

export function clearUploadedImage(diagnosisId: string): void {
  try {
    localStorage.removeItem(UPLOADED_IMAGE_PREFIX + diagnosisId);
  } catch {
    /* ignore */
  }
}

/**
 * 把用户上传的照片缩放并压缩成 JPEG data URL，控制请求体积。
 * 浏览器无法解码的格式（如部分 HEIC）返回 null，调用方回退到纯文生图。
 */
export async function fileToCompressedDataUrl(file: File): Promise<string | null> {
  try {
    const sourceUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("image decode failed"));
      element.src = sourceUrl;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return sourceUrl;
    }
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return null;
  }
}
