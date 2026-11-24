"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readUploadedImage } from "@/lib/client/uploaded-image";
import { presentationForStatus } from "@/lib/diagnosis-status-ui";
import { isExecutableDiagnosisStatus } from "@/lib/diagnosis-status";
import { isAdvancedFusionDiagnosis } from "@/lib/diagnosis-types";
import { useAuth } from "@/lib/useAuth";
import type { Diagnosis } from "@/lib/types";

/**
 * 个人形象分析图卡。
 *
 * 与远程实现的差异（均为本次任务的强制要求）：
 * 1. 进入结果页不会自动发起付费生图：挂载时只读取本地缓存，生成必须由用户点击触发。
 * 2. 请求携带 Firebase ID Token，复用项目现有鉴权方式。
 * 3. 发送参考照片前必须由用户显式勾选同意第三方处理。
 * 4. Phase 3.3：只要存在有效季型结果即可生成（含 UNCERTAIN / DEGRADED）；
 *    仅硬阻断状态（RETAKE_REQUIRED / FAILED）不允许，服务端会再次校验。
 * 5. 缓存失效时只提示用户手动重新生成，不会自动重发付费请求。
 */

interface StyleImageCardProps {
  diagnosis: Diagnosis;
}

const CACHE_PREFIX = "colorsense:style-image:";
const CONSENT_PREFIX = "colorsense:style-image-consent:";

interface CachedImage {
  url: string;
  colors: string[];
  usedReference: boolean;
  savedAt: number;
}

function readCache(diagnosisId: string): CachedImage | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + diagnosisId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedImage;
    if (!parsed || typeof parsed.url !== "string" || !Array.isArray(parsed.colors)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(diagnosisId: string, colors: string[], url: string, usedReference: boolean) {
  try {
    const payload: CachedImage = { url, colors, usedReference, savedAt: Date.now() };
    window.sessionStorage.setItem(CACHE_PREFIX + diagnosisId, JSON.stringify(payload));
  } catch {
    /* 缓存写入失败不影响主流程 */
  }
}

function hasConsented(diagnosisId: string): boolean {
  try {
    return window.sessionStorage.getItem(CONSENT_PREFIX + diagnosisId) === "1";
  } catch {
    return false;
  }
}

function rememberConsent(diagnosisId: string) {
  try {
    window.sessionStorage.setItem(CONSENT_PREFIX + diagnosisId, "1");
  } catch {
    /* ignore */
  }
}

function sameColors(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((color, index) => color === right[index]);
}

export function StyleImageCard({ diagnosis }: StyleImageCardProps) {
  const { currentUser } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReference, setHasReference] = useState(false);
  const [consented, setConsented] = useState(false);
  const [cacheInvalid, setCacheInvalid] = useState(false);
  const inFlight = useRef(false);

  // 数据来源统一取自最终诊断结果（融合后的色卡与季型），不使用单独的 CNN 分类结果。
  const colors = diagnosis.colorPalette.slice(0, 6);
  const fusion = diagnosis.fusionDiagnosis;
  const status = fusion && isAdvancedFusionDiagnosis(fusion) ? fusion.diagnosisStatus : "CONFIDENT";
  const presentation = presentationForStatus(status);
  // Phase 3.3：诊断可信程度与业务可执行性解耦——UNCERTAIN / DEGRADED 同样允许生成。
  const canGenerate = presentation.showFormalSeason && isExecutableDiagnosisStatus(status);

  // 挂载时只读取缓存，不发起任何付费请求。
  useEffect(() => {
    setHasReference(Boolean(readUploadedImage(diagnosis.id)));
    setConsented(hasConsented(diagnosis.id));

    const cached = readCache(diagnosis.id);
    if (!cached) {
      setImageUrl(null);
      setCacheInvalid(false);
      return;
    }
    const reference = Boolean(readUploadedImage(diagnosis.id));
    if (sameColors(cached.colors, colors) && cached.usedReference === reference) {
      setImageUrl(cached.url);
      setCacheInvalid(false);
    } else {
      // 缓存与当前诊断不匹配：只提示用户手动重新生成，不自动重发请求。
      setImageUrl(null);
      setCacheInvalid(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosis.id]);

  const generate = useCallback(
    async (options: { force: boolean }) => {
      if (inFlight.current || !canGenerate) {
        return;
      }

      const referenceImage = readUploadedImage(diagnosis.id);
      if (referenceImage && !hasConsented(diagnosis.id)) {
        setError("请先确认第三方照片处理说明，再生成图卡。");
        return;
      }

      if (!options.force) {
        const cached = readCache(diagnosis.id);
        if (cached && sameColors(cached.colors, colors) && cached.usedReference === Boolean(referenceImage)) {
          setImageUrl(cached.url);
          setCacheInvalid(false);
          setError(null);
          return;
        }
      }

      inFlight.current = true;
      setLoading(true);
      setError(null);

      try {
        if (!currentUser) {
          throw new Error("登录已过期，请重新登录后再试。");
        }
        const idToken = await currentUser.getIdToken();

        const resp = await fetch("/api/generate-style-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            diagnosisId: diagnosis.id,
            ...(referenceImage ? { image: referenceImage } : {}),
          }),
        });

        const data = (await resp.json().catch(() => null)) as
          | { success?: boolean; url?: string; error?: string }
          | null;

        if (!resp.ok || !data?.success || !data.url) {
          throw new Error(data?.error || "图片生成失败，请稍后重试。");
        }

        setImageUrl(data.url);
        setCacheInvalid(false);
        writeCache(diagnosis.id, colors, data.url, Boolean(referenceImage));
      } catch (err) {
        setError(err instanceof Error ? err.message : "图片生成失败，请稍后重试。");
        setImageUrl(null);
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [canGenerate, colors, currentUser, diagnosis.id],
  );

  if (!canGenerate) {
    return (
      <section className="glass-card rounded-[20px] p-6">
        <h2 className="text-xl font-bold text-[#181698]">个人形象分析图卡</h2>
        <p className="mt-2 text-sm leading-6 text-[#667694]">
          本次诊断状态为「{status}」，未产出有效季型结果，因此不生成推荐图卡。
        </p>
      </section>
    );
  }

  const needsConsent = hasReference && !consented;

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
          onClick={() => void generate({ force: imageUrl !== null })}
          disabled={loading || needsConsent}
          className="shrink-0 rounded-xl bg-[#181698] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2a28b8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "生成中..." : imageUrl ? "重新生成" : "生成图卡"}
        </button>
      </div>

      {hasReference && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">第三方照片处理说明</p>
          <p className="mt-2 leading-6">
            生成图卡时，你上传的原始照片将被发送至第三方 AI 服务（火山方舟 / 豆包）用于图生图处理。
            照片只用于本次生成，不会在本项目数据库中保存；关闭标签页后本地暂存的照片会被清除。
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={consented}
              onChange={(event) => {
                const next = event.target.checked;
                setConsented(next);
                if (next) {
                  rememberConsent(diagnosis.id);
                }
              }}
            />
            <span>我已了解并同意将照片发送至第三方服务用于图生图处理</span>
          </label>
        </div>
      )}

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
              onClick={() => void generate({ force: true })}
              className="ml-3 underline underline-offset-2 hover:text-red-900"
            >
              重试
            </button>
          </div>
        )}

        {imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            {cacheInvalid ? "缓存已失效，请点击「生成图卡」重新生成" : "点击「生成图卡」查看效果"}
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
