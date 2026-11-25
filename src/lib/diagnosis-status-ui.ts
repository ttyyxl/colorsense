import { SEASON_KEYS, type SeasonKey } from "./fusion.ts";
import type { DiagnosisRiskEntry, DiagnosisStatus } from "./diagnosis-types.ts";

/**
 * 诊断状态到前端展示的映射（纯函数，可测试）。
 * 前端不重复实现诊断决策算法，只负责根据后端给出的状态选择展示方式。
 */

export type StatusTone = "success" | "warning" | "danger" | "info";

export interface StatusPresentation {
  title: string;
  tone: StatusTone;
  /**
   * 是否展示季型结论（季型卡、色卡、风格建议、穿搭结论）。
   *
   * Phase 3.3：诊断可信程度与业务可执行性解耦——UNCERTAIN / DEGRADED
   * 只要存在有效季型结果，同样展示季型与后续建议，只是附加不确定性提示。
   */
  showFormalSeason: boolean;
  /** 是否展示候选季型（Top-1 / Top-2 及分数）。 */
  showCandidates: boolean;
  /** 是否提供重新上传入口。 */
  showRetake: boolean;
  /** 是否展示生成 OOTD 等依赖季型的下游入口。 */
  showDownstreamActions: boolean;
  /** 本次结果是否携带不确定性提示（用于结果页附加说明）。 */
  carriesUncertainty: boolean;
  description: string;
}

const PRESENTATIONS: Record<DiagnosisStatus, StatusPresentation> = {
  CONFIDENT: {
    title: "诊断完成",
    tone: "success",
    showFormalSeason: true,
    showCandidates: false,
    showRetake: false,
    showDownstreamActions: true,
    carriesUncertainty: false,
    description: "本次诊断满足当前诊断规则，可以展示正式季型与个性化建议。",
  },
  UNCERTAIN: {
    title: "本次诊断结果存在不确定性",
    tone: "warning",
    // Phase 3.3：不再因不确定性阻断业务——仍给出季型、色板与后续建议。
    showFormalSeason: true,
    showCandidates: true,
    showRetake: true,
    showDownstreamActions: true,
    carriesUncertainty: true,
    description: "两个模型的判断接近或存在分歧。本次仍会给出季型结果与个性化建议，但该结论存在不确定性，建议按下方建议优化照片后复诊以提高准确度。",
  },
  RETAKE_REQUIRED: {
    title: "照片质量不足，无法完成诊断",
    tone: "danger",
    showFormalSeason: false,
    showCandidates: false,
    showRetake: true,
    showDownstreamActions: false,
    carriesUncertainty: false,
    description: "检测到明确影响诊断可靠性的图像问题，请按建议重新拍摄。",
  },
  DEGRADED: {
    title: "本次仅使用单一模型分析",
    tone: "info",
    // Phase 3.3：单模型降级同样允许展示与继续生成后续建议。
    showFormalSeason: true,
    showCandidates: true,
    showRetake: true,
    showDownstreamActions: true,
    carriesUncertainty: true,
    description: "另一模型本次不可用。本次仍会给出基于可用模型的季型结果与个性化建议，建议在自然光下重新上传以完成双模型诊断。",
  },
  FAILED: {
    title: "诊断暂时无法完成",
    tone: "danger",
    showFormalSeason: false,
    showCandidates: false,
    showRetake: true,
    showDownstreamActions: false,
    carriesUncertainty: false,
    description: "服务暂时无法给出有效结果，请稍后重试或重新上传照片。",
  },
};

/** 老记录没有 diagnosisStatus 字段，按 CONFIDENT 处理以保持向后兼容。 */
export function presentationForStatus(status: DiagnosisStatus | string | undefined): StatusPresentation {
  if (status && status in PRESENTATIONS) {
    return PRESENTATIONS[status as DiagnosisStatus];
  }
  return PRESENTATIONS.CONFIDENT;
}

export const REASON_LABELS: Record<string, string> = {
  IMAGE_QUALITY_REJECT: "照片质量未达到诊断要求",
  IMAGE_QUALITY_WARNING: "照片存在一定干扰",
  TOP_SCORE_BELOW_THRESHOLD: "综合匹配分数偏低",
  TOP_GAP_BELOW_THRESHOLD: "前两种季型分数接近",
  MODEL_TOP1_MISMATCH: "两个模型的首选季型不同",
  MODEL_DISTRIBUTION_DISAGREEMENT: "两个模型的四季分布差异较大",
  CNN_LOW_DISCRIMINATION: "CNN 模型区分度不足",
  DOUBAO_LOW_DISCRIMINATION: "视觉模型区分度不足",
  SINGLE_MODEL_DEGRADED: "仅单一模型可用（另一模型本次服务不可用）",
  DOUBAO_REFUSED: "视觉模型已返回结果，但明确表示当前照片无法支持可靠判断",
  DOUBAO_UNRELIABLE: "视觉模型本次判断不可靠",
  DOUBAO_LIGHTING_WARNING: "视觉模型提示光照风险",
  DOUBAO_FILTER_WARNING: "视觉模型提示滤镜风险",
  MULTIPLE_INDEPENDENT_RISKS: "同时存在多项相互独立的干扰因素",
  ALL_MODELS_UNAVAILABLE: "两个模型均无法给出有效结果",
  NO_CLEAR_FACE: "未检测到清晰人脸",
  WEIGHT_NORMALIZATION_FAILED: "无法计算有效模型权重",
};

export function labelForReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

/**
 * 普通软警告（不阻止正式诊断，但需要在结果页提示）。
 * Phase 3.1 的历史记录没有风险分层字段，这里只对已知代码做保守映射。
 */
export const SOFT_WARNING_REASONS = new Set<string>([
  "IMAGE_QUALITY_WARNING",
  "DOUBAO_LIGHTING_WARNING",
  "DOUBAO_FILTER_WARNING",
  "MODEL_TOP1_MISMATCH",
]);

/**
 * 把诊断原因拆分为「决定性原因」与「普通软警告」。
 *
 * - 新记录带 risks 字段：直接按风险等级拆分。
 * - Phase 3.1 的历史记录没有 risks 字段：按已知软警告代码做保守回退拆分，
 *   保证历史记录仍能正确区分「导致不确定的原因」与「普通提示」。
 */
export function splitReasons(
  reasons: string[],
  risks?: DiagnosisRiskEntry[],
): { decisive: string[]; soft: string[] } {
  if (risks && risks.length > 0) {
    return {
      decisive: risks.filter((risk) => risk.level !== "SOFT_WARNING").map((risk) => risk.reason),
      soft: risks.filter((risk) => risk.level === "SOFT_WARNING").map((risk) => risk.reason),
    };
  }
  return {
    decisive: reasons.filter((reason) => !SOFT_WARNING_REASONS.has(reason)),
    soft: reasons.filter((reason) => SOFT_WARNING_REASONS.has(reason)),
  };
}

export const SEASON_LABELS: Record<string, string> = {
  spring: "Spring / 春",
  summer: "Summer / 夏",
  autumn: "Autumn / 秋",
  winter: "Winter / 冬",
};

// ---------- 四季综合匹配度：评分视图解析 ----------
//
// 结果页展示优化（2026-11）：展示层不重复执行加权计算。
// - 双模型融合成功（fusionDiagnosis.source === "fusion"）时，直接读取后端已完成
//   权重融合与归一化的 fusionDiagnosis.seasonScores；
// - 融合未启用或单模型降级时，使用实际有效的最终诊断评分 diagnosis.scores，
//   并明确标识来源，不得将单模型结果伪装为双模型融合结果；
// - 历史记录缺少评分字段时返回 null，由调用方决定不展示，不得伪造评分。

/** 四季综合匹配度视图：结果页「四季综合匹配度」模块的唯一数据来源。 */
export interface SeasonScoreView {
  /** 用于展示的四季评分（0-1）；仅包含取到合法数值的季型，不伪造缺失项。 */
  scores: Partial<Record<SeasonKey, number>>;
  /** 综合评分最高的季型；scores 为空时为 null。 */
  topSeason: SeasonKey | null;
  /** 是否为双模型加权融合后的综合评分。 */
  isDualFusion: boolean;
  /** 评分来源说明（结果页直接展示），必须如实反映实际生效的评分来源。 */
  sourceLabel: string;
  /** 双模型融合时的实际生效权重说明（如「专业模型 40% · 视觉模型 60%」）；非融合时为 null。 */
  weightLabel: string | null;
}

/** resolveSeasonScoreView 的输入：与 Diagnosis 结构兼容的最小契约。 */
export interface SeasonScoreRecord {
  /** 顶层最终诊断评分（与 fusionDiagnosis 同源）。 */
  scores?: unknown;
  /** 诊断来源：model / rules / mock。 */
  source?: unknown;
  /** 融合诊断结果（v1.0 或 v2.0 均可）。 */
  fusionDiagnosis?: unknown;
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** 提取四季评分中取到合法数值的季型；不伪造缺失季型。 */
function pickValidScores(raw: unknown): Partial<Record<SeasonKey, number>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const scores: Partial<Record<SeasonKey, number>> = {};
  for (const key of SEASON_KEYS) {
    const value = source[key];
    if (isValidScore(value)) scores[key] = value;
  }
  return scores;
}

function topSeasonOf(scores: Partial<Record<SeasonKey, number>>): SeasonKey | null {
  let top: SeasonKey | null = null;
  for (const key of SEASON_KEYS) {
    const value = scores[key];
    if (value !== undefined && (top === null || value > (scores[top] ?? Number.NEGATIVE_INFINITY))) {
      top = key;
    }
  }
  return top;
}

/** 从 fusionDiagnosis.effectiveWeights 动态生成实际生效权重说明；缺失或非法时返回 null。 */
export function formatEffectiveWeightsLabel(weights: unknown): string | null {
  if (typeof weights !== "object" || weights === null) return null;
  const record = weights as { cnn?: unknown; doubao?: unknown };
  if (!isValidScore(record.cnn) || !isValidScore(record.doubao)) return null;
  return `专业模型 ${Math.round(record.cnn * 100)}% · 视觉模型 ${Math.round(record.doubao * 100)}%`;
}

function readFusionSource(fusionDiagnosis: unknown): string | null {
  if (typeof fusionDiagnosis !== "object" || fusionDiagnosis === null) return null;
  const source = (fusionDiagnosis as { source?: unknown }).source;
  return typeof source === "string" ? source : null;
}

/**
 * 解析结果页「四季综合匹配度」模块所需的评分视图。
 *
 * 数据来源优先级：
 * 1. fusionDiagnosis.source === "fusion"（双模型融合成功）：
 *    使用 fusionDiagnosis.seasonScores（后端已完成权重融合与归一化），
 *    实际生效权重从 fusionDiagnosis.effectiveWeights 动态读取。
 *    不使用 fusionDiagnosis.cnn / fusionDiagnosis.doubao 的单模型原始评分。
 * 2. 其余情况（融合未启用、单模型降级、历史记录）：
 *    使用实际有效的最终诊断评分 diagnosis.scores；fusionDiagnosis.seasonScores
 *    仅在 diagnosis.scores 整体缺失时作为同源兜底，来源标识仍如实标注为单模型。
 * 3. 取不到任何合法评分时返回 null，调用方不得伪造评分。
 */
export function resolveSeasonScoreView(record: SeasonScoreRecord): SeasonScoreView | null {
  const fusionSource = readFusionSource(record.fusionDiagnosis);
  const fusionScoresRaw =
    typeof record.fusionDiagnosis === "object" && record.fusionDiagnosis !== null
      ? (record.fusionDiagnosis as { seasonScores?: unknown }).seasonScores
      : undefined;
  const fusionWeights =
    typeof record.fusionDiagnosis === "object" && record.fusionDiagnosis !== null
      ? (record.fusionDiagnosis as { effectiveWeights?: unknown }).effectiveWeights
      : undefined;
  const finalScores = pickValidScores(record.scores);
  const fusionScores = pickValidScores(fusionScoresRaw);

  // 双模型融合成功：以后端融合分数为准；仅在其整体缺失时用同源顶层分数兜底。
  if (fusionSource === "fusion") {
    const scores = Object.keys(fusionScores).length > 0 ? fusionScores : finalScores;
    if (Object.keys(scores).length === 0) return null;
    return {
      scores,
      topSeason: topSeasonOf(scores),
      isDualFusion: true,
      sourceLabel: "评分来源：双模型加权融合综合评分",
      weightLabel: formatEffectiveWeightsLabel(fusionWeights),
    };
  }

  // 融合未启用或单模型降级：使用实际有效的最终诊断评分，并如实标识来源。
  const scores = Object.keys(finalScores).length > 0 ? finalScores : fusionScores;
  if (Object.keys(scores).length === 0) return null;

  let sourceLabel: string;
  if (fusionSource === "cnn") {
    sourceLabel = "评分来源：专业模型（FaRL）单独诊断";
  } else if (fusionSource === "doubao") {
    sourceLabel = "评分来源：视觉模型单独诊断";
  } else if (record.source === "rules") {
    sourceLabel = "评分来源：基础色彩分析（非模型诊断）";
  } else {
    sourceLabel = "评分来源：专业模型（FaRL）单模型评分";
  }

  return {
    scores,
    topSeason: topSeasonOf(scores),
    isDualFusion: false,
    sourceLabel,
    weightLabel: null,
  };
}
