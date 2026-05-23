"use client";

import { useState } from "react";

export function UploadZone() {
  const [fileName, setFileName] = useState<string>("");

  return (
    <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-white p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
      <input
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />
      <span className="text-4xl">＋</span>
      <span className="mt-4 text-lg font-semibold text-slate-950">拖拽或点击上传照片</span>
      <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">建议使用正面、自然光、无遮挡照片。支持 JPG、PNG、HEIC、WebP，最大 10MB。</span>
      {fileName && <span className="mt-4 rounded-full bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700">{fileName}</span>}
    </label>
  );
}
