"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SEASONS } from "@/lib/seasons";
import type { Diagnosis } from "@/lib/types";
import { useEffect, useState } from "react";

export default function HistoryPage() {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      const response = await fetch("/api/diagnoses", { cache: "no-store" });
      const payload = await response.json();

      if (payload.success) {
        setDiagnoses(payload.data);
      }

      setIsLoading(false);
    }

    loadHistory();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold text-indigo-700">P06 历史记录</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-950">你的诊断记录</h1>

        {isLoading && <div className="mt-8 rounded-2xl border border-indigo-100 bg-white p-6 text-slate-600">正在读取历史记录...</div>}

        {!isLoading && diagnoses.length === 0 && (
          <div className="mt-8 rounded-2xl border border-indigo-100 bg-white p-6">
            <h2 className="text-2xl font-bold text-slate-950">还没有诊断记录</h2>
            <p className="mt-3 text-slate-600">上传一张正面照后，这里会显示你的历史诊断。</p>
            <Link href="/upload" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">
              开始第一次诊断
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {diagnoses.map((diagnosis) => {
            const season = SEASONS[diagnosis.season_type];

            return (
              <Link key={diagnosis.id} href={`/result/${diagnosis.id}`} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{new Date(diagnosis.created_at).toLocaleString("zh-CN")}</p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-950">
                      {season.emoji} {season.name}
                    </h2>
                    {diagnosis.image_name && <p className="mt-1 text-sm text-slate-500">{diagnosis.image_name}</p>}
                  </div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">{Math.round(diagnosis.confidence * 100)}%</span>
                </div>
                <div className="mt-4 flex gap-2">
                  {diagnosis.color_palette.map((color) => (
                    <span key={color} className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
