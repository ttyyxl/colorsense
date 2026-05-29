"use client";

import type { RefObject } from "react";
import { useState } from "react";
import html2canvas from "html2canvas-pro";

interface ShareModalProps {
  diagnosisId: string;
  cardRef: RefObject<HTMLDivElement>;
}

export function ShareModal({ diagnosisId, cardRef }: ShareModalProps) {
  const [message, setMessage] = useState("把当前结果卡片保存为 PNG，方便发给朋友或留档。");
  const [isSaving, setIsSaving] = useState(false);

  async function saveCard() {
    const card = cardRef.current;
    const debug = process.env.NODE_ENV !== "production";

    if (debug) {
      console.info("[export-debug] Card lookup", {
        cardRefPresent: Boolean(card),
      });
    }

    if (!card) {
      setMessage("没有找到可保存的结果卡片。");
      return;
    }

    setIsSaving(true);

    try {
      const canvas = await html2canvas(card, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: debug,
      });

      if (debug) {
        console.info("[export-debug] Canvas generated", {
          canvasPresent: Boolean(canvas),
          width: canvas.width,
          height: canvas.height,
        });
      }

      const dataUrl = canvas.toDataURL("image/png");
      if (debug) {
        console.info("[export-debug] PNG encoded", {
          dataUrlPresent: Boolean(dataUrl),
        });
      }

      const link = document.createElement("a");
      link.download = `colorsense-result-${diagnosisId}.png`;
      link.href = dataUrl;
      link.click();
      if (debug) {
        console.info("[export-debug] Download triggered", {
          linkCreated: true,
          clickTriggered: true,
        });
      }
      setMessage("结果卡片已生成 PNG。");
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError";
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[export-debug] PNG export failed", { name, message: errorMessage });
      setMessage(debug ? `保存失败：${errorMessage}` : "保存失败，请稍后再试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-slate-950">保存结果卡片</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
      <button
        type="button"
        className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={isSaving}
        onClick={saveCard}
      >
        {isSaving ? "正在保存..." : "下载 PNG"}
      </button>
    </div>
  );
}
