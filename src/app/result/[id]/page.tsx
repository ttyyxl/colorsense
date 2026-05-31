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
import { FooterGradient } from "@/components/home/FooterGradient"; // Import FooterGradient
import { motion } from "framer-motion"; // Import motion

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const; // Define springTransition

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
  const hasUnreliableFaceQuality = diagnosis?.faceDetected === false || diagnosis?.usedOriginalImage === true;
  const hasVerifiedModelAnalysis =
    diagnosis?.source === "model" && diagnosis.faceDetected === true && diagnosis.usedOriginalImage === false;

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
    <ProtectedRoute>
      <main className="home-dashboard-shell min-h-screen text-[#181698]">
        <Navbar />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="mx-auto flex w-full max-w-7xl flex-col gap-18 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:gap-20 md:pb-20 lg:pt-8"
        >
          <section className="mx-auto max-w-4xl px-6 py-10">
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
                <div ref={cardRef} id="share-card" className="glass-card-strong gpu-safe mt-4 space-y-6 rounded-[20px] p-5 sm:p-8">
                  <header className="glass-card rounded-[20px] p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#578af4]">ColorSense</p>
                    <h1 className="mt-2 text-2xl font-bold text-[#181698]">色彩季型诊断结果</h1>
                    <p className="mt-3 text-sm text-[#667694]">Result ID: {id}</p>
                  </header>
                  {hasUnreliableFaceQuality && (
                    <section className="rounded-[20px] border border-amber-300 bg-amber-50 p-5 text-amber-900">
                      <p className="font-semibold">结果质量警告</p>
                      <p className="mt-2 leading-7">
                        未检测到清晰人脸，本次结果可能受背景、光线或图片整体色彩影响，建议重新上传自然光下的正脸照。
                      </p>
                    </section>
                  )}
                  {diagnosis.source === "rules" && (
                    <section className="glass-card rounded-[20px] p-5 text-[#667694]">
                      本次结果为基础色彩分析，不是完整模型人脸分析。
                    </section>
                  )}
                  <SeasonCard season={season} confidence={diagnosis.confidence} />
                  {diagnosis.aiAdvice && (
                    <AiAdviceSection advice={diagnosis.aiAdvice} />
                  )}


                  {diagnosis.scores && (
                    <section className="glass-card rounded-[20px] p-6">
                      <h2 className="text-xl font-bold text-[#181698]">四季分类置信分数</h2>
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
                  <section className="glass-card rounded-[20px] p-6">
                    <h2 className="text-xl font-bold text-[#181698]">推荐穿搭色系</h2>
                    <div className="mt-5">
                      <ColorPalette colors={diagnosis.colorPalette} />
                    </div>
                  </section>
                  <section className="glass-card rounded-[20px] p-6">
                    <h2 className="text-xl font-bold text-[#181698]">风格建议</h2>
                    <p className="mt-4 leading-8 text-[#667694]">{diagnosis.aiDescription}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {diagnosis.styleKeywords.map((keyword) => (
                        <span key={keyword} className="glass-card rounded-full px-3 py-1 text-sm font-semibold text-[#578af4]">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <p className="mt-5 text-sm text-[#667694]">谨慎使用：{diagnosis.avoidColors.join(" / ")}</p>
                    <p className="mt-3 text-sm text-[#667694]">生成时间：{new Date(diagnosis.createdAt).toLocaleString("zh-CN")}</p>
                  </section>
                  {diagnosis.doubaoAdvice && (
                    <DoubaoAdviceSection advice={diagnosis.doubaoAdvice} />
                  )}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"> {/* Adjusted grid for better responsiveness */}
                  <ShareModal diagnosisId={id} cardRef={cardRef} />
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.1 }}>
                    <Link href="/upload" className="group inline-flex h-full w-full items-center justify-center rounded-[20px] glass-card px-5 py-3 text-sm font-semibold text-[#181698] transition hover:-translate-y-0.5">
                      重新诊断
                    </Link>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.15 }}>
                    <Link href="/history" className="group inline-flex h-full w-full items-center justify-center rounded-[20px] glass-card px-5 py-3 text-sm font-semibold text-[#181698] transition hover:-translate-y-0.5">
                      查看历史
                    </Link>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.2 }}>
                    <Link href="/outfit" className="group inline-flex h-full w-full items-center justify-center rounded-[20px] glass-card px-5 py-3 text-sm font-semibold text-[#181698] transition hover:-translate-y-0.5">
                      生成今日 OOTD
                    </Link>
                  </motion.div>
                </div>
              </>
            )}
          </section>
        </motion.div>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}
