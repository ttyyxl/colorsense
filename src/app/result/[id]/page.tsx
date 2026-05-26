"use client";

import Link from "next/link";
import { ColorPalette } from "@/components/ColorPalette";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SeasonCard } from "@/components/SeasonCard";
import { AiAdviceSection } from "@/components/AiAdviceSection";
import { DoubaoAdviceSection } from "@/components/DoubaoAdviceSection";
import { ShareModal } from "@/components/ShareModal";
import { getUserDiagnosis } from "@/lib/firestore-diagnoses";
import { SEASONS } from "@/lib/seasons";
import type { Diagnosis } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useRef, useState } from "react";

const SCORE_LABELS = {
  spring: "Spring / 春",
  summer: "Summer / 夏",
  autumn: "Autumn / 秋",
  winter: "Winter / 冬",
} as const;

interface ResultPageProps {
  params: { id: string };
}

export default function ResultPage({ params }: ResultPageProps) {
  const { id } = params;
  const { currentUser } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [error, setError] = useState("");
  const season = diagnosis ? SEASONS[diagnosis.seasonType] : null;

  useEffect(() => {
    let ignore = false;

    async function loadDiagnosis() {
      if (!currentUser) {
        return;
      }
      try {
        const payload = await getUserDiagnosis(id, currentUser.uid);

        if (!payload) {
          throw new Error("没有找到这次诊断记录，或你无权查看该记录。");
        }
        if (!SEASONS[payload.seasonType]) {
          throw new Error("The diagnosis result contains an unsupported season type. Please run a new diagnosis.");
        }
        if (!ignore) {
          setDiagnosis(payload);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "没有找到诊断结果。");
        }
      }
    }

    loadDiagnosis();

    return () => {
      ignore = true;
    };
  }, [currentUser, id]);

  return (
    <ProtectedRoute><main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm font-semibold text-indigo-700">P05 结果页 · {id}</p>
        {error && (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6">
            <h1 className="text-2xl font-bold text-red-900">结果暂时不可用</h1>
            <p className="mt-3 leading-7 text-red-700">{error}</p>
            <Link href="/upload" className="mt-5 inline-flex rounded-xl bg-red-600 px-5 py-3 font-semibold text-white">
              重新上传
            </Link>
          </div>
        )}

        {!error && !season && <div className="mt-6 rounded-2xl border border-indigo-100 bg-white p-6 text-slate-600">正在读取诊断结果...</div>}

        {diagnosis && season && (
          <>
            <div ref={cardRef} id="share-card" className="mt-4 space-y-6 rounded-3xl bg-white p-5 sm:p-8">
              <header className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-100">ColorSense</p>
                <h1 className="mt-2 text-2xl font-bold">色彩季型诊断结果</h1>
                <p className="mt-3 text-sm text-indigo-100">Result ID: {id}</p>
              </header>
              <SeasonCard season={season} confidence={diagnosis.confidence} />
              
              {diagnosis.aiAdvice && (
                <AiAdviceSection advice={diagnosis.aiAdvice} />
              )}

              {diagnosis.doubaoAdvice && (
                <DoubaoAdviceSection advice={diagnosis.doubaoAdvice} />
              )}

              {diagnosis.scores && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-950">四季分类置信分数</h2>
                  <div className="mt-5 space-y-4">
                    {Object.entries(SCORE_LABELS).map(([key, label]) => {
                      const score = diagnosis.scores?.[key as keyof typeof SCORE_LABELS] ?? 0;
                      return (
                        <div key={key}>
                          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                            <span className="font-semibold text-slate-700">{label}</span>
                            <span className="text-slate-500">{Math.round(score * 100)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.max(0, Math.min(score, 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">推荐穿搭色系</h2>
                <div className="mt-5">
                  <ColorPalette colors={diagnosis.colorPalette} />
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">风格建议</h2>
                <p className="mt-4 leading-8 text-slate-600">{diagnosis.aiDescription}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {diagnosis.styleKeywords.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                      {keyword}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm text-slate-500">谨慎使用：{diagnosis.avoidColors.join(" / ")}</p>
                <p className="mt-3 text-sm text-slate-500">生成时间：{new Date(diagnosis.createdAt).toLocaleString("zh-CN")}</p>
              </section>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <ShareModal diagnosisId={id} cardRef={cardRef} />
              <Link href="/upload" className="rounded-2xl border border-indigo-100 bg-white p-5 font-semibold text-indigo-700">
                重新诊断
              </Link>
              <Link href="/history" className="rounded-2xl border border-indigo-100 bg-white p-5 font-semibold text-indigo-700">
                查看历史
              </Link>
            </div>
          </>
        )}
      </section>
    </main></ProtectedRoute>
  );
}
