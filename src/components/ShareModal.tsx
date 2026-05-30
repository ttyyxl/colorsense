"use client";

import type { RefObject } from "react";
import { useState } from "react";
import html2canvas from "html2canvas-pro";

interface ShareModalProps {
  diagnosisId: string;
  cardRef: RefObject<HTMLDivElement>;
}

export function ShareModal({ diagnosisId, cardRef }: ShareModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      <div
        className={`font-semibold text-indigo-700 ${isSaving ? "opacity-50 cursor-wait" : "cursor-pointer hover:text-indigo-700"}`}
        onClick={!isSaving ? saveCard : undefined}
      >
        保存结果卡片
        {isSaving && <span className="ml-2 text-sm text-slate-500">正在保存...</span>}
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.includes("失败") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}