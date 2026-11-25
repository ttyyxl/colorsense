"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Check } from "lucide-react";
import { getAuthToken } from "@/lib/client/api";
import {
  COLOR_CARDS,
  SEASON_LABELS,
  describeColorCardSeasons,
  summarizeColorCardSelections,
  type ColorCardSelection,
} from "@/lib/color-card";
import { SEASON_KEYS } from "@/lib/vision-schema";

interface ColorCardTestProps {
  redirectPath?: string;
}

/** 根据色块明暗选择可读的文字与虚线颜色。 */
function textColorFor(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#0f172a" : "#ffffff";
}

/** 与人脸轮廓近似的虚线引导框。 */
function FaceGuide({ color = "rgba(15,23,42,0.5)" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full p-[6%]"
      style={{ color }}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M50 7C31.8 7 18 21 18 41c0 12.5 3.2 24 9.5 34.5C33.5 85.5 41 93 50 93s16.5-7.5 22.5-17.5C78.8 65 82 53.5 82 41 82 21 68.2 7 50 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ColorCardTest({ redirectPath = "/upload" }: ColorCardTestProps) {
  const router = useRouter();
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState<ColorCardSelection[]>([]);
  const [finished, setFinished] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [consentOpen, setConsentOpen] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRefs.current.forEach((video) => {
      if (video) {
        video.srcObject = null;
      }
    });
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera(): Promise<boolean> {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("当前浏览器不支持调用摄像头，请直接选择色块。");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRefs.current.forEach((video) => {
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => undefined);
        }
      });
      setCameraOn(true);
      return true;
    } catch {
      setCameraError("无法打开摄像头，请检查浏览器权限，或直接选择色块。");
      return false;
    }
  }

  async function acceptConsent() {
    if (requesting) {
      return;
    }
    setRequesting(true);
    const opened = await startCamera();
    setRequesting(false);
    if (opened) {
      setConsentOpen(false);
    }
  }

  function attachVideo(slot: number) {
    return (element: HTMLVideoElement | null) => {
      videoRefs.current[slot] = element;
      if (element && streamRef.current) {
        element.srcObject = streamRef.current;
        void element.play().catch(() => undefined);
      }
    };
  }

  function finish(nextSelections: ColorCardSelection[]) {
    stopCamera();
    setSelections(nextSelections);
    setFinished(true);
  }

  function chooseSeason(season: ColorCardSelection["season"]) {
    const next = [...selections, { cardId: COLOR_CARDS[index].id, season }];
    if (index === COLOR_CARDS.length - 1) {
      finish(next);
      return;
    }
    setSelections(next);
    setIndex(index + 1);
  }

  function skip() {
    stopCamera();
    router.push(redirectPath);
  }

  async function saveAndContinue() {
    if (saveState === "saving") {
      return;
    }
    setSaveState("saving");
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/user-profile/color-card-test", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selections }),
      });
      const payload = (await response.json()) as { success?: boolean };
      if (!response.ok || !payload.success) {
        throw new Error("SAVE_FAILED");
      }
      router.push(redirectPath);
    } catch {
      setSaveState("error");
    }
  }

  if (finished) {
    const seasons = summarizeColorCardSelections(selections);
    return (
      <div className="rounded-3xl border border-indigo-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_45%,#f6f2ff_100%)] px-6 py-12 text-slate-900 shadow-xl">
        <div className="mx-auto flex w-full max-w-xl flex-col justify-center">
          <p className="text-sm font-semibold tracking-wide text-indigo-600">色卡自测结果</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-950">
            您的色卡选择表示您为{describeColorCardSeasons(seasons)}
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            这是通过四组色块与面部对比得到的参考结果，不是图片诊断的结论。你可以决定是否把它保存到个人档案。
          </p>

          <ul className="mt-6 space-y-2">
            {selections.map((selection, position) => {
              const card = COLOR_CARDS.find((item) => item.id === selection.cardId);
              return (
                <li key={selection.cardId} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <span className="text-sm text-slate-500">
                    色卡 {position + 1} · {card?.name ?? selection.cardId}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span
                      className="inline-block h-4 w-4 rounded-full ring-1 ring-slate-200"
                      style={{ backgroundColor: card?.colors[selection.season] }}
                      aria-hidden="true"
                    />
                    {SEASON_LABELS[selection.season]}
                  </span>
                </li>
              );
            })}
          </ul>

          {saveState === "error" && (
            <p role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              保存失败，请检查网络后重试，或选择不保存。
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={saveAndContinue}
              disabled={saveState === "saving"}
              className="flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <Check className="h-5 w-5" aria-hidden="true" />
              {saveState === "saving" ? "正在保存..." : "相信，保存到个人档案"}
            </button>
            <button
              type="button"
              onClick={() => router.push(redirectPath)}
              className="rounded-full border border-indigo-200 px-6 py-3 text-base font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              不太准，不保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  const card = COLOR_CARDS[index];

  return (
    <div className="relative flex h-[min(72vh,720px)] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-indigo-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_45%,#f6f2ff_100%)] text-slate-900 shadow-xl">
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="cs-face-clip" clipPathUnits="objectBoundingBox">
            <path d="M0.5 0.07C0.318 0.07 0.18 0.21 0.18 0.41c0 0.125 0.032 0.24 0.095 0.345C0.335 0.855 0.41 0.93 0.5 0.93s0.165-0.075 0.225-0.175C0.788 0.65 0.82 0.535 0.82 0.41 0.82 0.21 0.682 0.07 0.5 0.07Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">色卡自测 · {index + 1} / {COLOR_CARDS.length}</p>
          <p className="mt-1 text-xs text-slate-500">{card.name}：觉得哪个颜色最适合你，就点击那个颜色（点击即选中）</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cameraOn ? stopCamera : startCamera}
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {cameraOn ? (
              <CameraOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Camera className="h-4 w-4" aria-hidden="true" />
            )}
            {cameraOn ? "关闭摄像头" : "打开摄像头"}
          </button>
          <button
            type="button"
            onClick={skip}
            className="rounded-full border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            跳过
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        <div className="grid h-full grid-cols-2 grid-rows-2">
          {SEASON_KEYS.map((season, slot) => {
            const labelColor = textColorFor(card.colors[season]);
            const guideColor = labelColor === "#ffffff" ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.45)";
            return (
              <button
                key={season}
                type="button"
                onClick={() => chooseSeason(season)}
                aria-label={`选择${SEASON_LABELS[season]}色块`}
                className="relative flex items-center justify-center p-4 text-left transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-slate-900"
                style={{ backgroundColor: card.colors[season] }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="relative h-[clamp(88px,22vmin,200px)] w-[clamp(88px,22vmin,200px)]">
                    <div className="absolute inset-[6%]" style={{ clipPath: "url(#cs-face-clip)" }}>
                      <video
                        ref={attachVideo(slot)}
                        className={`h-full w-full scale-x-[-1] object-cover ${cameraOn ? "block" : "hidden"}`}
                        playsInline
                        muted
                        autoPlay
                      />
                    </div>
                    <FaceGuide color={guideColor} />
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: labelColor }}>
                    把脸放进虚线框
                  </span>
                </div>
                <span className="absolute bottom-4 left-4 text-lg font-semibold" style={{ color: labelColor }}>
                  {SEASON_LABELS[season]}人
                </span>
              </button>
            );
          })}
        </div>

        {cameraError && !consentOpen && (
          <p className="absolute bottom-4 left-1/2 w-[min(92%,520px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-white/90 px-4 py-2 text-center text-xs text-amber-700 shadow-sm backdrop-blur">
            {cameraError}
          </p>
        )}
      </div>

      {consentOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="color-card-consent-title"
            className="w-full max-w-md rounded-2xl border border-indigo-100 bg-white p-6 text-slate-900 shadow-2xl"
          >
            <h2 id="color-card-consent-title" className="text-xl font-bold text-slate-950">
              开启摄像头进行色卡自测？
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              需要把脸放进四个色块的虚线框里逐一对比。画面只在本机预览，不会上传或保存。不开启摄像头将跳过本次色卡测试。
            </p>
            {cameraError && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {cameraError}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={acceptConsent}
                disabled={requesting}
                className="flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <Camera className="h-5 w-5" aria-hidden="true" />
                {requesting ? "正在打开..." : "打开摄像头"}
              </button>
              <button
                type="button"
                onClick={skip}
                className="rounded-full border border-indigo-200 px-6 py-3 text-base font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                跳过测试
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
