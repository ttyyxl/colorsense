"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import type { ApiResponse, NewDiagnosis } from "@/lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function UploadZone() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectFile(nextFile?: File) {
    setError("");

    if (!nextFile) {
      return;
    }

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
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          selectFile(event.dataTransfer.files[0]);
        }}
      >
        <button
          type="button"
          className="flex min-h-56 flex-col items-center justify-center rounded-xl bg-indigo-50 px-6 text-center transition hover:bg-indigo-100"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <Upload className="h-10 w-10 text-indigo-600" aria-hidden="true" />
          <span className="mt-4 text-lg font-semibold text-slate-950">拖拽或点击上传照片</span>
          <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">建议使用正面、自然光、无遮挡照片。支持 JPG、PNG、HEIC、WebP，最大 10MB。</span>
        </button>

        <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {previewUrl ? (
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
