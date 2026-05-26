"use client";

import Link from "next/link";
import { ColorPalette } from "@/components/ColorPalette";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SeasonCard } from "@/components/SeasonCard";
import { ShareModal } from "@/components/ShareModal";
import { getUserDiagnosis } from "@/lib/firestore-diagnoses";
import { SEASONS } from "@/lib/seasons";
import type { Diagnosis } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useState } from "react";

interface ResultPageProps {
  params: { id: string };
}

export default function ResultPage({ params }: ResultPageProps) {
  const { id } = params;
  const { currentUser } = useAuth();
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
            <div id="share-card" className="mt-4 space-y-6">
              <SeasonCard season={season} confidence={diagnosis.confidence} />
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
              <ShareModal />
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
