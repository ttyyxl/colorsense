"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import type { ApiResponse, NewDiagnosis } from "@/lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const NO_CLEAR_FACE_MESSAGE = "未检测到清晰人脸，请在自然光下重新上传或拍摄正面人像照片。";
const MODEL_UNAVAILABLE_MESSAGE = "模型服务暂时不可用，请稍后重试。";

export function UploadZone() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [noClearFace, setNoClearFace] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsCameraStarting(false);
  }

  function resetSelectedImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(null);
    setPreviewUrl("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function selectFile(nextFile?: File) {
    if (isSubmitting) {
      return;
    }

    setError("");
    setNoClearFace(false);

    if (!nextFile) {
      return;
    }

    stopCamera();

    if (!ALLOWED_TYPES.has(nextFile.type)) {
      setError("仅支持 JPG、PNG、HEIC 或 WebP 图片。");
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setError("图片不能超过 10MB，请压缩后重试。");
      return;
    }

    setFile(nextFile);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function startCamera() {
    if (isSubmitting || isCameraStarting) {
      return;
    }

    setError("");
    setNoClearFace(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("当前设备不支持拍照，请改为上传图片。");
      return;
    }

    setIsCameraStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);

      window.requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          void videoRef.current.play();
        }
      });
    } catch (err) {
      stopCamera();
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "无法访问摄像头，请检查浏览器权限或改为上传照片。"
          : "摄像头打开失败，请改为上传照片。",
      );
    } finally {
      setIsCameraStarting(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      setError("摄像头尚未准备好，请稍后再试。");
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setError("摄像头画面尚未加载完成，请稍后再拍摄。");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      setError("拍照失败，请改为上传照片。");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setError("拍照失败，请改为上传照片。");
      return;
    }

    selectFile(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  async function submitDiagnosis() {
    if (!file) {
      setError("请先上传一张清晰正面照。");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      if (!currentUser) {
        throw new Error("登录已过期，请重新登录。");
      }

      const idToken = await currentUser.getIdToken(true);

      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as ApiResponse<NewDiagnosis>;
      console.info("[diagnose-debug] API response", {
        status: response.status,
        ok: response.ok,
        keys: Object.keys(payload),
        diagnosisIdPresent: payload.success && Boolean(payload.diagnosisId),
      });

      if (!response.ok || !payload.success) {
        if (!payload.success && payload.error === "NO_CLEAR_FACE") {
          resetSelectedImage();
          setNoClearFace(true);
          setError(NO_CLEAR_FACE_MESSAGE);
          return;
        }
        if (!payload.success && payload.error === "MODEL_UNAVAILABLE") {
          throw new Error(payload.message ?? MODEL_UNAVAILABLE_MESSAGE);
        }
        throw new Error(payload.success ? "诊断失败，请稍后重试。" : payload.error);
      }

      if (!payload.diagnosisId) {
        throw new Error("Diagnosis completed, but no result ID was returned. Please try again.");
      }

      console.info("[diagnose-debug] Router navigation", {
        routerPushExecuted: true,
        diagnosisIdPresent: true,
      });
      router.push(`/result/${payload.diagnosisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "诊断失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`grid min-h-80 gap-6 rounded-2xl border-2 border-dashed bg-white p-5 transition md:grid-cols-[0.9fr_1.1fr] ${
          isDragging ? "border-indigo-500 bg-indigo-50" : "border-indigo-200"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isSubmitting) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!isSubmitting) {
            selectFile(event.dataTransfer.files[0]);
          }
        }}
      >
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl bg-indigo-50 px-6 py-6 text-center">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            disabled={isSubmitting}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <Upload className="h-10 w-10 text-indigo-600" aria-hidden="true" />
          <span className="mt-4 text-lg font-semibold text-slate-950">拖拽或点击上传照片</span>
          <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            建议使用正面、自然光、无遮挡照片。支持 JPG、PNG、HEIC、WebP，最大 10MB。
          </span>
          <div className="mt-5 grid w-full gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={() => inputRef.current?.click()}
              disabled={isSubmitting}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              上传照片
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={startCamera}
              disabled={isSubmitting || isCameraStarting}
            >
              {isCameraStarting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
              拍照
            </button>
          </div>
        </div>

        <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {isCameraOpen ? (
            <div className="flex h-full w-full flex-col gap-3 p-3">
              <video ref={videoRef} className="min-h-52 w-full rounded-xl bg-slate-900 object-contain" playsInline muted />
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                >
                  拍摄
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  取消
                </button>
              </div>
            </div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="上传照片预览" className="h-full max-h-80 w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center px-6 text-center text-slate-500">
              <Camera className="h-10 w-10" aria-hidden="true" />
              <p className="mt-3 text-sm leading-6">照片预览会显示在这里，确认清晰后再开始诊断。</p>
            </div>
          )}
        </div>
      </div>

      {file && (
        <div className="rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-600">
          已选择：<span className="font-semibold text-slate-950">{file.name}</span>
        </div>
      )}

      {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      {noClearFace && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">重新拍摄建议</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>请上传真人正脸照片，保持脸部正对镜头</li>
            <li>避免遮挡、墨镜、口罩</li>
            <li>避免强逆光或过暗环境</li>
            <li>尽量使用自然光</li>
            <li>请勿上传动物、卡通、风景、物体或多人合照</li>
          </ul>
        </div>
      )}

      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:w-auto"
        disabled={isSubmitting}
        onClick={submitDiagnosis}
      >
        {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {isSubmitting ? "正在诊断..." : "开始诊断"}
      </button>
    </div>
  );
}
