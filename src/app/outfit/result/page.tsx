"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Palette, RefreshCw, Shirt, Sparkles } from "lucide-react";
import html2canvas from "html2canvas-pro";
import { Suspense, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FooterGradient } from "@/components/home/FooterGradient";
import { useAuth } from "@/lib/useAuth";
import type { OutfitHistoryRecord, OutfitInspirationApiResponse, OutfitInspirationRequest, OutfitInspirationResult } from "@/lib/outfit-types";

interface StoredOutfitResult {
  request: OutfitInspirationRequest;
  result: OutfitInspirationResult;
  source: "mock" | "ai";
  outfitId?: string;
  resultId?: string;
  imageUrl?: string;
  createdAt?: string;
}

const EMPTY_REQUEST: OutfitInspirationRequest = {
  season: "",
  profile: {
    favoriteColors: [],
    stylePreferences: [],
    makeupPreference: "",
  },
  scene: "daily",
  occasion: "",
  mood: "",
  weather: null,
};

const EMPTY_RESULT: OutfitInspirationResult = {
  theme: "",
  color_palette: [],
  item_recommendations: {
    top: "",
    bottom: "",
    outerwear: "",
    shoes: "",
    bag: "",
    accessories: "",
  },
  makeup_advice: "",
  reason: "",
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function normalizeRequest(request: Partial<OutfitInspirationRequest> | null | undefined): OutfitInspirationRequest {
  const profile = (request?.profile ?? {}) as Partial<OutfitInspirationRequest["profile"]> & { rawProfile?: unknown };
  const weather = request?.weather && typeof request.weather === "object" ? (request.weather as NonNullable<OutfitInspirationRequest["weather"]>) : null;

  return {
    season: asString(request?.season),
    profile: {
      favoriteColors: asStringList(profile.favoriteColors),
      stylePreferences: asStringList(profile.stylePreferences),
      makeupPreference: asString(profile.makeupPreference),
      rawProfile: profile.rawProfile ?? null,
    },
    scene: request?.scene === "travel" ? "travel" : "daily",
    occasion: asString(request?.occasion),
    mood: asString(request?.mood),
    weather: weather
      ? {
          city: asString(weather.city),
          temperature: asString(weather.temperature),
          condition: asString(weather.condition),
          source: weather.source === "weatherapi" || weather.source === "mock" ? weather.source : undefined,
        }
      : null,
  };
}

function normalizeResult(result: Partial<OutfitInspirationResult> | null | undefined): OutfitInspirationResult {
  const itemRecommendations = (result?.item_recommendations ?? {}) as Partial<OutfitInspirationResult["item_recommendations"]>;

  return {
    ...EMPTY_RESULT,
    theme: asString(result?.theme),
    color_palette: asStringList(result?.color_palette),
    item_recommendations: {
      top: asString(itemRecommendations.top),
      bottom: asString(itemRecommendations.bottom),
      outerwear: asString(itemRecommendations.outerwear),
      shoes: asString(itemRecommendations.shoes),
      bag: asString(itemRecommendations.bag),
      accessories: asString(itemRecommendations.accessories),
    },
    makeup_advice: asString(result?.makeup_advice),
    reason: asString(result?.reason),
  };
}

function normalizeStoredResult(raw: unknown): StoredOutfitResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const root = raw as Record<string, unknown>;
  return {
    request: normalizeRequest(root.request as Partial<OutfitInspirationRequest> | null | undefined),
    result: normalizeResult(root.result as Partial<OutfitInspirationResult> | null | undefined),
    source: root.source === "mock" ? "mock" : "ai",
    outfitId: asString(root.outfitId),
    resultId: asString(root.resultId),
    imageUrl: asString(root.imageUrl),
    createdAt: asString(root.createdAt),
  };
}

function formatStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function isRequestReady(request: OutfitInspirationRequest) {
  return Boolean(request.season && request.occasion && request.mood);
}

function storedFromRecord(record: OutfitHistoryRecord): StoredOutfitResult {
  return {
    request: record.request,
    result: record.result,
    source: record.source,
    outfitId: record.outfitId ?? record.id,
    resultId: record.resultId ?? record.id,
    imageUrl: record.imageUrl,
    createdAt: record.createdAt,
  };
}

async function persistOutfitRecord(
  token: string,
  payload: {
    request: OutfitInspirationRequest;
    result: OutfitInspirationResult;
    source: "mock" | "ai";
    imageUrl?: string;
    recordId?: string;
  },
) {
  const endpoint = payload.recordId ? `/api/outfit-records/${encodeURIComponent(payload.recordId)}` : "/api/outfit-records";
  const response = await fetch(endpoint, {
    method: payload.recordId ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      request: payload.request,
      result: payload.result,
      source: payload.source,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    }),
  });
  const responsePayload = (await response.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };
  if (!response.ok || !responsePayload.success) {
    throw new Error(responsePayload.error ?? "OUTFIT_RECORD_SAVE_FAILED");
  }
  return responsePayload.id ?? payload.recordId ?? "";
}

function OutfitResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const [stored, setStored] = useState<StoredOutfitResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const recordId = searchParams.get("id")?.trim() ?? "";

  useEffect(() => {
    const raw = sessionStorage.getItem("colorsense-outfit-result");
    if (!raw) {
      return;
    }

    try {
      setStored(normalizeStoredResult(JSON.parse(raw)));
    } catch {
      sessionStorage.removeItem("colorsense-outfit-result");
    }
  }, []);

  useEffect(() => {
    if (!recordId || !currentUser) {
      return;
    }

    let ignore = false;

    async function loadRecord() {
      setError("");
      try {
        if (!currentUser) {
          setError("请先登录后查看穿搭记录。");
          return;
        }

        const token = await currentUser.getIdToken(true);
        const response = await fetch(`/api/outfit-records/${encodeURIComponent(recordId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json().catch(() => ({}))) as { success?: boolean; record?: OutfitHistoryRecord; error?: string };
        if (!response.ok || !payload.success || !payload.record) {
          throw new Error(payload.error ?? "OUTFIT_DETAIL_FAILED");
        }

        const nextStored = storedFromRecord(payload.record);
        if (!ignore) {
          setStored(nextStored);
          sessionStorage.setItem("colorsense-outfit-result", JSON.stringify(nextStored));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "绌挎惌鏃ヨ璇︽儏璇诲彇澶辫触锛岃绋嶅悗閲嶈瘯銆?");
        }
      }
    }

    void loadRecord();

    return () => {
      ignore = true;
    };
  }, [currentUser, recordId]);

  async function saveResult() {
    const card = contentRef.current;
    if (!card) {
      setError("未找到可保存的结果区域。");
      return;
    }

    setIsSaving(true);
    setNotice("");
    setError("");

    try {
      const canvas = await html2canvas(card, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: process.env.NODE_ENV !== "production",
      });
      const imageUrl = canvas.toDataURL("image/png");
      downloadDataUrl(imageUrl, `outfit-${formatStamp()}.png`);

      const nextRecord = {
        request: stored?.request ?? EMPTY_REQUEST,
        result: stored?.result ?? EMPTY_RESULT,
        source: stored?.source ?? "ai",
        imageUrl,
      };

      let recordId = stored?.outfitId || stored?.resultId || "";
      if (currentUser) {
        const token = await currentUser.getIdToken(true);
        recordId = await persistOutfitRecord(token, {
          ...nextRecord,
          recordId,
        });
      }

      const nextStored: StoredOutfitResult = {
        request: nextRecord.request,
        result: nextRecord.result,
        source: nextRecord.source,
        imageUrl,
        createdAt: stored?.createdAt ?? new Date().toISOString(),
        outfitId: recordId || stored?.outfitId,
        resultId: recordId || stored?.resultId,
      };

      setStored(nextStored);
      sessionStorage.setItem("colorsense-outfit-result", JSON.stringify(nextStored));
      setNotice("PNG 已下载，结果也已同步保存。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  async function regenerateResult() {
    const request = stored?.request ?? EMPTY_REQUEST;
    if (!isRequestReady(request)) {
      setError("当前记录缺少季型、场合或心情，暂时无法重新生成。");
      return;
    }

    setIsRegenerating(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/outfit-inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = (await response.json()) as OutfitInspirationApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "OUTFIT_REGENERATE_FAILED" : payload.error ?? "OUTFIT_REGENERATE_FAILED");
      }

      const nextResult = payload.data;
      const source = payload.source === "mock" ? "mock" : "ai";
      const nextStored: StoredOutfitResult = {
        request,
        result: nextResult,
        source,
        createdAt: new Date().toISOString(),
      };

      if (currentUser) {
        const token = await currentUser.getIdToken(true);
        const recordId = await persistOutfitRecord(token, {
          request,
          result: nextResult,
          source,
        });
        nextStored.outfitId = recordId;
        nextStored.resultId = recordId;
      }

      setStored(nextStored);
      sessionStorage.setItem("colorsense-outfit-result", JSON.stringify(nextStored));
      setNotice("已重新生成新的穿搭结果，并写入历史记录。");
      const nextId = nextStored.resultId || nextStored.outfitId;
      if (nextId) {
        router.push(`/outfit/result?id=${encodeURIComponent(nextId)}`);
      }
    } catch (regenError) {
      setError(regenError instanceof Error ? regenError.message : "重新生成失败，请稍后重试。");
    } finally {
      setIsRegenerating(false);
    }
  }

  const request = stored?.request ?? EMPTY_REQUEST;
  const result = stored?.result ?? EMPTY_RESULT;
  const hasResult = Boolean(stored && result.theme);

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-white">
        <Navbar />
        <section className="mx-auto max-w-4xl px-6 py-8">
          {!hasResult ? (
            <div className="rounded-3xl border border-amber-200 bg-white p-7 shadow-xl shadow-indigo-100">
              <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                穿搭结果
              </p>
              <h1 className="mt-4 text-2xl font-bold text-slate-950">当前没有可展示的穿搭结果</h1>
              <p className="mt-3 leading-7 text-slate-600">请重新生成一套穿搭，或者返回穿搭页面继续操作。</p>
              <Link href="/outfit" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">
                去生成穿搭
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div ref={contentRef} className="space-y-5">
                <header className="rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-xl shadow-indigo-100">
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    穿搭灵感结果
                  </p>
                  <h1 className="mt-4 text-3xl font-bold">{result.theme || "穿搭结果"}</h1>
                  <p className="mt-3 text-sm text-indigo-100">
                    {request.weather?.city || "未知城市"} / {request.occasion || "未知场合"} / {request.mood || "未知心情"}
                  </p>
                </header>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-950">
                    <Shirt className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                    基本信息
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Meta label="季型" value={request.season || "未知季型"} />
                    <Meta label="场景" value={request.scene === "travel" ? "旅行" : "日常"} />
                    <Meta label="场合" value={request.occasion || "未知场合"} />
                    <Meta label="心情" value={request.mood || "未知心情"} />
                    <Meta label="城市" value={request.weather?.city || "未填写"} />
                    <Meta label="天气" value={request.weather?.condition || "未填写"} />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-950">
                    <Palette className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                    推荐色彩
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {result.color_palette.length > 0 ? (
                      result.color_palette.map((color) => (
                        <div key={color} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
                          <span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
                          <span className="text-sm text-slate-700">{color}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">暂无可展示的颜色建议。</p>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-950">
                    <Shirt className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                    搭配卡片
                  </h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Item label="上装" value={result.item_recommendations.top} />
                    <Item label="下装" value={result.item_recommendations.bottom} />
                    <Item label="外套" value={result.item_recommendations.outerwear} />
                    <Item label="鞋子" value={result.item_recommendations.shoes} />
                    <Item label="包袋" value={result.item_recommendations.bag} />
                    <Item label="配饰" value={result.item_recommendations.accessories} />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-950">妆容建议</h2>
                  <p className="mt-3 leading-7 text-slate-600">{result.makeup_advice || "暂无妆容建议。"}</p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-950">推荐原因</h2>
                  <p className="mt-3 leading-7 text-slate-600">{result.reason || "暂无推荐说明。"}</p>
                </section>
              </div>

              {(notice || error) && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
                  {error || notice}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void saveResult()}
                  disabled={isSaving}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-white px-5 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {isSaving ? "保存中..." : "保存结果"}
                </button>
                <button
                  type="button"
                  onClick={() => void regenerateResult()}
                  disabled={isRegenerating}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-white px-5 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} aria-hidden="true" />
                  {isRegenerating ? "生成中..." : "重新生成"}
                </button>
                <Link href="/history" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50">
                  <Shirt className="h-4 w-4" aria-hidden="true" />
                  查看历史
                </Link>
                <Link href="/" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  返回首页
                </Link>
              </div>
            </div>
          )}
        </section>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}

export default function OutfitResultPage() {
  return (
    <Suspense fallback={<div>正在加载穿搭结果...</div>}>
      <OutfitResultContent />
    </Suspense>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 leading-7 text-slate-800">{value || "未填写"}</p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 leading-7 text-slate-800">{value || "暂无建议"}</p>
    </div>
  );
}
