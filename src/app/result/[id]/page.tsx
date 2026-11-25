"use client";

import Link from "next/link";
import { ColorPalette } from "@/components/ColorPalette";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SeasonCard } from "@/components/SeasonCard";
import { AiAdviceSection } from "@/components/AiAdviceSection";
import { DoubaoAdviceSection } from "@/components/DoubaoAdviceSection";
import { ShareModal } from "@/components/ShareModal";
import { StyleImageCard } from "@/components/StyleImageCard";
import { getUserDiagnosis } from "@/lib/client/diagnoses";
import { SEASONS } from "@/lib/seasons";
import type { Diagnosis } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useRef, useState } from "react";
import { FooterGradient } from "@/components/home/FooterGradient"; // Import FooterGradient
import { motion } from "framer-motion"; // Import motion
import { DiagnosisStatusNotice } from "@/components/DiagnosisStatusNotice";
import { presentationForStatus, resolveSeasonScoreView, splitReasons } from "@/lib/diagnosis-status-ui";
import { isAdvancedFusionDiagnosis } from "@/lib/diagnosis-types";
import { resolveDiagnosisStatusOf } from "@/lib/diagnosis-status";

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const; // Define springTransition
const resultActionCardClassName =
  "inline-flex min-h-[88px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:text-indigo-700";

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
  const fusion = diagnosis?.fusionDiagnosis;
  const advancedFusion = fusion && isAdvancedFusionDiagnosis(fusion) ? fusion : null;
  const hasV2Diagnosis = advancedFusion !== null;
  const diagnosisStatus = diagnosis ? resolveDiagnosisStatusOf(diagnosis) : "CONFIDENT";
  const presentation = presentationForStatus(diagnosisStatus);
  const season = diagnosis && presentation.showFormalSeason ? SEASONS[diagnosis.seasonType] : null;
  const uncertaintyReasons = advancedFusion?.uncertaintyReasons ?? diagnosis?.uncertaintyReasons ?? [];
  const risks = advancedFusion?.risks ?? diagnosis?.risks ?? [];
  // 决定性原因与普通软警告分开展示；软警告不阻止正式季型展示。
  const { decisive: decisiveReasons, soft: softWarnings } = splitReasons(uncertaintyReasons, risks);
  const recommendations = advancedFusion?.recommendations ?? diagnosis?.recommendations ?? [];
  const candidates = advancedFusion ? advancedFusion.candidateSeasons : [];
  const hasUnreliableFaceQuality = diagnosis?.faceDetected === false || diagnosis?.usedOriginalImage === true;
  // 四季综合匹配度：双模型融合成功时直接读取后端融合评分；
  // 融合未启用或单模型降级时使用实际有效的最终诊断评分并如实标注来源。
  const seasonScoreView = diagnosis ? resolveSeasonScoreView(diagnosis) : null;
  // 历史记录（无 v2 状态字段）保持可展示，但明确标注其未经新版可靠性判断。
  const isLegacyRecord = Boolean(diagnosis) && !hasV2Diagnosis;

  useEffect(() => {
    let ignore = false;

    async function loadDiagnosis() {
      if (!currentUser) {
        return;
      }
      try {
        const payload = await getUserDiagnosis(id);

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

            {!error && !diagnosis && <div className="mt-6 rounded-2xl border border-indigo-100 bg-white p-6 text-slate-600">正在读取诊断结果...</div>}

            {diagnosis && !season && (
              // 仅在无法给出有效季型结果（RETAKE_REQUIRED / FAILED 等硬阻断状态）时
              // 展示必要的错误/重拍提示；成功获得有效季型结果的记录不再展示
              // 冗余的不确定性卡片（UNCERTAIN / DEGRADED 不阻断业务流程）。
              <DiagnosisStatusNotice
                status={diagnosisStatus}
                reasons={decisiveReasons}
                softWarnings={softWarnings}
                recommendations={recommendations}
                candidates={candidates}
              />
            )}

            {isLegacyRecord && (
              <section className="rounded-[20px] border border-slate-200 bg-slate-50 p-5 text-slate-700">
                <p className="font-semibold">历史诊断记录</p>
                <p className="mt-2 leading-7">
                  该记录生成于可靠性判断机制上线之前，未经过图像质量评估、双模型一致性与不确定性判断，
                  因此不代表已通过新版诊断规则校验的正式结论。
                </p>
              </section>
            )}

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


                  {seasonScoreView && (
                    <section className="glass-card rounded-[20px] p-6">
                      <h2 className="text-xl font-bold text-[#181698]">四季综合匹配度</h2>
                      <p className="mt-2 text-sm text-[#667694]">{seasonScoreView.sourceLabel}</p>
                      <div className="mt-5 space-y-4">
                        {Object.entries(SCORE_LABELS).map(([key, label]) => {
                          const score = seasonScoreView.scores[key as keyof typeof SCORE_LABELS];
                          // 历史记录可能缺少某个季型的评分：缺失时不伪造，直接跳过该季型。
                          if (score === undefined) return null;
                          const isTopSeason = seasonScoreView.topSeason === key;
                          return (
                            <div key={key}>
                              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                                <span className={`flex items-center gap-2 ${isTopSeason ? "font-bold text-[#181698]" : "font-semibold text-slate-700"}`}>
                                  {label}
                                  {isTopSeason && (
                                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                      最终季型
                                    </span>
                                  )}
                                </span>
                                <span className={isTopSeason ? "font-bold text-[#181698]" : "text-slate-500"}>
                                  {(score * 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${isTopSeason ? "bg-indigo-600" : "bg-indigo-300"}`}
                                  style={{ width: `${Math.max(0, Math.min(score, 1)) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {seasonScoreView.weightLabel && (
                        <p className="mt-5 text-sm text-[#667694]">
                          实际生效权重：{seasonScoreView.weightLabel}
                        </p>
                      )}
                    </section>
                  )}
                  <section className="glass-card rounded-[20px] p-6">
                    <h2 className="text-xl font-bold text-[#181698]">推荐穿搭色系</h2>
                    <div className="mt-5">
                      <ColorPalette colors={diagnosis.colorPalette} />
                    </div>
                  </section>
                  <StyleImageCard diagnosis={diagnosis} />
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
                <div className="mt-6 grid justify-center gap-3 sm:grid-cols-2 lg:grid-cols-4"> {/* Adjusted grid for better responsiveness */}
                  {presentation.showDownstreamActions && (
                    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.05 }}>
                      <ShareModal diagnosisId={id} cardRef={cardRef} />
                    </motion.div>
                  )}
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.1 }}>
                    <Link href="/upload" className={resultActionCardClassName}>
                      重新诊断
                    </Link>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.15 }}>
                    <Link href="/history" className={resultActionCardClassName}>
                      查看历史
                    </Link>
                  </motion.div>
                  {presentation.showDownstreamActions && (
                    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.2 }}>
                      <Link href="/outfit" className={resultActionCardClassName}>
                        生成今日 OOTD
                      </Link>
                    </motion.div>
                  )}
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
