"use client";

import { useEffect, useState } from "react";
import { readUploadedImage } from "@/lib/client/uploaded-image";
import type { Diagnosis } from "@/lib/types";

interface StyleImageCardProps {
  diagnosis: Diagnosis;
}

const CACHE_PREFIX = "colorsense:style-image:";

interface CachedImage {
  url: string;
  colors: string[];
  usedReference: boolean;
  savedAt: number;
}

function readCache(diagnosisId: string, colors: string[], usedReference: boolean): string | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + diagnosisId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedImage;
    if (
      parsed &&
      parsed.url &&
      parsed.usedReference === usedReference &&
      Array.isArray(parsed.colors) &&
      parsed.colors.length === colors.length &&
      parsed.colors.every((c, i) => c === colors[i])
    ) {
      return parsed.url;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(diagnosisId: string, colors: string[], url: string, usedReference: boolean) {
  try {
    const payload: CachedImage = { url, colors, usedReference, savedAt: Date.now() };
    localStorage.setItem(CACHE_PREFIX + diagnosisId, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function StyleImageCard({ diagnosis }: StyleImageCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReference, setHasReference] = useState(false);

  const colors = diagnosis.colorPalette.slice(0, 6);

  useEffect(() => {
    setHasReference(Boolean(readUploadedImage(diagnosis.id)));
  }, [diagnosis.id]);

  async function generate(useCache = true) {
    setLoading(true);
    setError(null);

    const referenceImage = readUploadedImage(diagnosis.id);

    if (useCache) {
      const cached = readCache(diagnosis.id, colors, Boolean(referenceImage));
      if (cached) {
        setImageUrl(cached);
        setLoading(false);
        return;
      }
    }

    try {
      const resp = await fetch("/api/generate-style-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colors,
          season: diagnosis.seasonType,
          labFeatures: diagnosis.labFeatures,
          ...(referenceImage ? { image: referenceImage } : {}),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success || !data?.url) {
        throw new Error(data?.error || "图片生成失败");
      }
      setImageUrl(data.url);
      writeCache(diagnosis.id, colors, data.url, Boolean(referenceImage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片生成失败");
      setImageUrl(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void generate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosis.id]);

  return (
    <section className="glass-card rounded-[20px] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#181698]">个人形象分析图卡</h2>
          <p className="mt-1 text-sm text-[#667694]">
            {hasReference
              ? "基于你上传的照片，模拟同一张脸换上六种穿搭颜色的效果"
              : "根据诊断的推荐色系，模拟同一张脸换上六种穿搭颜色的效果"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => generate(false)}
          disabled={loading}
          className="shrink-0 rounded-xl bg-[#181698] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2a28b8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "生成中..." : imageUrl ? "重新生成" : "生成图卡"}
        </button>
      </div>

      <div className="mt-5">
        {loading && !imageUrl && (
          <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-[#667694]">
            正在为你生成形象分析图卡，约需 10-30 秒...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            生成失败：{error}
            <button
              type="button"
              onClick={() => generate(false)}
              className="ml-3 underline underline-offset-2 hover:text-red-900"
            >
              重试
            </button>
          </div>
        )}

        {imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img
              src={imageUrl}
              alt="个人形象分析图卡"
              className="h-auto w-full object-contain"
              onError={() => {
                setError("图片加载失败，请尝试重新生成");
                setImageUrl(null);
              }}
            />
          </div>
        )}

        {!loading && !imageUrl && !error && (
          <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-[#667694]">
            点击「生成图卡」查看效果
          </div>
        )}
      </div>

      {imageUrl && (
        <p className="mt-3 text-xs text-[#9aa6bf]">
          {hasReference
            ? "提示：图卡由 AI 以你上传的照片为参考，保留真实五官与肤色，仅更换穿搭颜色，仅供穿搭颜色参考。"
            : "提示：图卡由 AI 基于诊断色系生成，肤色与气质依据你的色彩季型模拟，仅供穿搭颜色参考。"}
        </p>
      )}
    </section>
  );
}
