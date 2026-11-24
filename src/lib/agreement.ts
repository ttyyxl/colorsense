import { argmaxSeason, normalizeSeasonScores, SEASON_KEYS, type SeasonKey, type SeasonScores } from "./fusion.ts";
import { SCORE_TIE_EPSILON, UNCERTAINTY_THRESHOLDS as U } from "./diagnosis-config.ts";
import type { UncertaintyThresholds } from "./diagnosis-config.ts";
import type { ModelAgreement } from "./diagnosis-types.ts";

/**
 * 两模型分歧评估：以总变差距离（Total Variation Distance, TVD）作为主要分布差异指标。
 *
 * TVD 定义：0.5 × Σ|p_i - q_i|，范围 [0, 1]。0 表示四季分布完全一致，1 表示完全分离。
 * 选择单一主指标，避免无意义叠加多个相似指标；Top-1/Top-2 与分差作为辅助解释。
 *
 * 阈值含义（初始配置，待独立验证集校准）：
 * - TVD >= 0.40 → high（较大分布分歧）
 * - Top-1 不一致但 TVD < 0.40 → moderate（触发进一步分析，不直接认定失败）
 * - 其余 → low
 */

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function totalVariationDistance(cnn: SeasonScores, doubao: SeasonScores): number {
  const normalizedCnn = normalizeSeasonScores(cnn);
  const normalizedDoubao = normalizeSeasonScores(doubao);
  if (!normalizedCnn || !normalizedDoubao) return 1; // 非法分布视为最大分歧，交由上层拒绝
  let distance = 0;
  for (const key of SEASON_KEYS) {
    distance += Math.abs(normalizedCnn[key] - normalizedDoubao[key]);
  }
  return round(0.5 * distance);
}

function topTwo(scores: SeasonScores): [SeasonKey, SeasonKey] {
  const sorted = [...SEASON_KEYS].sort((a, b) => scores[b] - scores[a]);
  return [sorted[0], sorted[1]];
}

function topGap(scores: SeasonScores): number {
  const [first, second] = topTwo(scores);
  return round(Math.max(0, scores[first] - scores[second]));
}

/**
 * 计算模型一致性。传入分数应为已通过 validateSeasonScores 的合法分数；
 * 非法时返回 null，由上层决定降级/失败，不在此伪造分布。
 */
export function evaluateModelAgreement(
  cnn: SeasonScores,
  doubao: SeasonScores,
  fused?: SeasonScores,
  thresholds?: Partial<UncertaintyThresholds>,
): ModelAgreement | null {
  const normalizedCnn = normalizeSeasonScores(cnn);
  const normalizedDoubao = normalizeSeasonScores(doubao);
  if (!normalizedCnn || !normalizedDoubao) return null;

  const tvdLimit = thresholds?.totalVariationDistance ?? U.totalVariationDistance;
  const cnnTop = argmaxSeason(normalizedCnn);
  const doubaoTop = argmaxSeason(normalizedDoubao);
  const cnnTwo = topTwo(normalizedCnn);
  const doubaoTwo = topTwo(normalizedDoubao);
  const tvd = totalVariationDistance(normalizedCnn, normalizedDoubao);
  const top1Match = cnnTop === doubaoTop;
  const top2Overlap = cnnTwo.some((season) => doubaoTwo.includes(season));

  let level: ModelAgreement["level"] = "low";
  if (tvd >= tvdLimit) {
    level = "high";
  } else if (!top1Match || tvd >= tvdLimit / 2) {
    level = "moderate";
  }

  const normalizedFused = fused ? normalizeSeasonScores(fused) : null;
  return {
    top1Match,
    top2Overlap,
    cnnTopGap: topGap(normalizedCnn),
    doubaoTopGap: topGap(normalizedDoubao),
    fusedTopGap: normalizedFused ? topGap(normalizedFused) : 0,
    totalVariationDistance: tvd,
    level,
  };
}

/** 辅助：判断分数差距是否落在阈值边界（含等号）以下。统一使用 <= 边界规则。 */
export function isGapBelowThreshold(gap: number, threshold: number): boolean {
  return gap <= threshold + SCORE_TIE_EPSILON;
}
