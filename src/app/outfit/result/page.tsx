"use client";

import Link from "next/link";
import { ArrowLeft, Palette, RefreshCw, Shirt, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { OutfitInspirationRequest, OutfitInspirationResult } from "@/lib/outfit-types";

interface StoredOutfitResult {
  request: OutfitInspirationRequest;
  result: OutfitInspirationResult;
  source: "mock" | "ai";
}

export default function OutfitResultPage() {
  const [stored, setStored] = useState<StoredOutfitResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("colorsense-outfit-result");
    if (!raw) {
      return;
    }

    try {
      setStored(JSON.parse(raw) as StoredOutfitResult);
    } catch {
      sessionStorage.removeItem("colorsense-outfit-result");
    }
  }, []);

  const result = stored?.result;

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-white">
        <Navbar />
        <section className="mx-auto max-w-4xl px-6 py-8">
          {!result ? (
            <div className="rounded-3xl border border-amber-200 bg-white p-7 shadow-xl shadow-indigo-100">
              <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                今日 OOTD
              </p>
              <h1 className="mt-4 text-2xl font-bold text-slate-950">暂无穿搭结果</h1>
              <p className="mt-3 leading-7 text-slate-600">请先选择场景和心情，生成今日穿搭灵感。</p>
              <Link href="/outfit" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">
                去生成
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <header className="rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-xl shadow-indigo-100">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  今日穿搭灵感
                </p>
                <h1 className="mt-4 text-3xl font-bold">{result.theme}</h1>
                <p className="mt-3 text-sm text-indigo-100">
                  {stored.request.weather?.city || "今日"} · {stored.request.occasion} · {stored.request.mood}
                </p>
              </header>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-950">
                  <Palette className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                  配色方案
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ColorCard label="主色" value={result.mainColor} className="bg-indigo-100 text-indigo-800" />
                  <ColorCard label="辅助色" value={result.secondaryColor} className="bg-slate-100 text-slate-800" />
                  <ColorCard label="点缀色" value={result.accentColor} className="bg-purple-100 text-purple-800" />
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-950">
                  <Shirt className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                  单品推荐
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Item label="上衣" value={result.top} />
                  <Item label="下装" value={result.bottom} />
                  <Item label="外套" value={result.outerwear} />
                  <Item label="鞋子" value={result.shoes} />
                  <Item label="包包" value={result.bag} />
                  <Item label="配饰" value={result.accessories} />
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">妆容建议</h2>
                <p className="mt-3 leading-7 text-slate-600">{result.makeup}</p>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">适合原因</h2>
                <p className="mt-3 leading-7 text-slate-600">{result.reason}</p>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/outfit"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-white px-5 font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  重新生成
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  返回诊断
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </ProtectedRoute>
  );
}

function ColorCard({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`rounded-2xl px-4 py-4 ${className}`}>
      <p className="text-xs font-semibold opacity-70">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 leading-7 text-slate-800">{value}</p>
    </div>
  );
}
