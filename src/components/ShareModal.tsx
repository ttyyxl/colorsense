"use client";

import { useState } from "react";

export function ShareModal() {
  const [message, setMessage] = useState("分享卡片功能将在结果页接入。");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-slate-950">保存结果卡片</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
      <button
        type="button"
        className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        onClick={() => setMessage("MVP 已预留 html2canvas 截图入口，下一阶段接入真实结果卡片。")}
      >
        预览分享能力
      </button>
    </div>
  );
}
