import type { DiagnosisRiskEntry, DiagnosisStatus } from "./diagnosis-types.ts";

/**
 * 诊断状态到前端展示的映射（纯函数，可测试）。
 * 前端不重复实现诊断决策算法，只负责根据后端给出的状态选择展示方式。
 */

export type StatusTone = "success" | "warning" | "danger" | "info";

export interface StatusPresentation {
  title: string;
  tone: StatusTone;
  /** 是否展示确定性季型结论（季型卡、色卡、风格建议、穿搭结论）。 */
  showFormalSeason: boolean;
  /** 是否展示候选季型（Top-1 / Top-2 及分数）。 */
  showCandidates: boolean;
  /** 是否提供重新上传入口。 */
  showRetake: boolean;
  /** 是否展示生成 OOTD 等依赖正式季型的入口。 */
  showDownstreamActions: boolean;
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
    description: "本次诊断满足当前诊断规则，可以展示正式季型与个性化建议。",
  },
  UNCERTAIN: {
    title: "本次诊断结果存在不确定性",
    tone: "warning",
    showFormalSeason: false,
    showCandidates: true,
    showRetake: true,
    showDownstreamActions: false,
    description: "两个模型的判断接近或存在分歧，本次不输出确定性季型。",
  },
  RETAKE_REQUIRED: {
    title: "照片质量不足，无法完成诊断",
    tone: "danger",
    showFormalSeason: false,
    showCandidates: false,
    showRetake: true,
    showDownstreamActions: false,
    description: "检测到明确影响诊断可靠性的图像问题，请按建议重新拍摄。",
  },
  DEGRADED: {
    title: "本次仅使用单一模型分析",
    tone: "info",
    showFormalSeason: false,
    showCandidates: true,
    showRetake: true,
    showDownstreamActions: false,
    description: "另一模型本次不可用，结果存在局限，仅作为候选参考。",
  },
  FAILED: {
    title: "诊断暂时无法完成",
    tone: "danger",
    showFormalSeason: false,
    showCandidates: false,
    showRetake: true,
    showDownstreamActions: false,
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
