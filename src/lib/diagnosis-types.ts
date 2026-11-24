import type { FusionDiagnosis, FusionWeights, SeasonKey } from "./fusion.ts";

/**
 * 第三阶段诊断数据结构（v2），对 fusionDiagnosis v1.0 做向后兼容扩展。
 * v1 的全部字段（predictedSeason / seasonScores / source / cnn / doubao /
 * requestedWeights / effectiveWeights / fallbackReason 等）原样保留。
 *
 * 语义边界：
 * - confidence 字段始终是「未校准的匹配分数」，不是真实正确概率。
 * - RETAKE_REQUIRED / FAILED 不生成诊断记录，因此不会写入 seasonType。
 * - UNCERTAIN / DEGRADED 会保存记录以便追溯，但诊断状态独立于季型名称，
 *   下游必须先看 diagnosisStatus 再决定是否作为正式结论。
 */

export type ImageQualityLevel = "PASS" | "WARNING" | "REJECT";
export type IssueSeverity = "info" | "warning" | "critical";
export type DiagnosisStatus = "CONFIDENT" | "UNCERTAIN" | "RETAKE_REQUIRED" | "DEGRADED" | "FAILED";
export type InferenceMode = "dual" | "dual-refused" | "single-cnn" | "single-doubao" | "unavailable";
export type ConfidenceType =
  | "uncalibrated_fusion_score"
  | "uncalibrated_single_model_score"
  | "unavailable";

/**
 * 诊断风险等级（Phase 3.2 分层风险机制）。
 *
 * - SOFT_WARNING：轻度质量或环境风险。保留在诊断结果与前端提示中，
 *   但**不单独**阻止正式诊断输出。
 * - DECISIVE_RISK：足以影响诊断可信度的风险。命中任意一条即进入 UNCERTAIN。
 * - BLOCKING_ISSUE：图像或服务无法支持可靠诊断。对应 RETAKE_REQUIRED / FAILED。
 */
export type DiagnosisRiskLevel = "SOFT_WARNING" | "DECISIVE_RISK" | "BLOCKING_ISSUE";

export interface DiagnosisRiskEntry {
  /** 机器可读原因代码，与 uncertaintyReasons 使用同一套代码，便于前后端对照。 */
  reason: string;
  level: DiagnosisRiskLevel;
  /**
   * 风险分组。同一分组内的多条风险视为相互关联（例如多处轻微色偏提示），
   * 不重复计为「多项相互独立的风险」，避免制造虚假的高风险。
   */
  group: string;
}

export interface ImageQualityMetric {
  /** 数值或 unknown（无法可靠判断时不用默认值冒充通过）。 */
  value: number | "unknown";
  /** 该指标是否基于近似区域（中心区域代替人脸框）。 */
  approximate?: boolean;
  /** 指标说明。 */
  note?: string;
}

export interface ImageQualityIssue {
  /** 机器可读问题代码，不含用户原文。 */
  code: string;
  severity: IssueSeverity;
  /** 面向用户的具体改善建议。 */
  message: string;
}

export interface ImageQualityAssessment {
  /** 整体质量评分 0-1；越高越好。 */
  overallQuality: number;
  qualityLevel: ImageQualityLevel;
  metrics: {
    width: ImageQualityMetric;
    height: ImageQualityMetric;
    meetsModelInput: ImageQualityMetric;
    faceDetected: ImageQualityMetric;
    faceCount: ImageQualityMetric;
    faceConfidence: ImageQualityMetric;
    faceAreaRatio: ImageQualityMetric;
    laplacianVariance: ImageQualityMetric;
    clippedBrightRatio: ImageQualityMetric;
    clippedDarkRatio: ImageQualityMetric;
    channelCast: ImageQualityMetric;
    suspectedFilter: ImageQualityMetric;
    occlusion: ImageQualityMetric;
  };
  issues: ImageQualityIssue[];
  severity: "none" | "low" | "medium" | "high";
  /** 针对用户的具体改善建议（按优先级排序）。 */
  recommendation: string[];
  /** 校准状态说明。 */
  calibrationNote: string;
}

export interface WeightAdjustment {
  model: "cnn" | "doubao";
  /** 调整阶段：可用性 / 适用性（图像质量） / 已验证可靠性。 */
  stage: "availability" | "applicability" | "reliability" | "clamp" | "normalize";
  /** 乘性系数，1 表示中性不调整。 */
  factor: number;
  /** 调整原因（机器可读短语，不含敏感内容）。 */
  reason: string;
}

export interface EffectiveWeightsResult {
  /** 用户配置/基准权重，不被动态算法改写。 */
  requestedWeights: FusionWeights;
  /** 本次诊断实际生效权重，归一化后和为 1。 */
  effectiveWeights: FusionWeights;
  /** 无法归一化（两模型均不可用或零权重）时为 false，不得强行归一化。 */
  normalized: boolean;
  /** 各模型可用性。 */
  available: { cnn: boolean; doubao: boolean };
  /** 调整原因列表；无调整时为说明保持基准的中性条目。 */
  adjustments: WeightAdjustment[];
  /** 一句话汇总调整依据。 */
  adjustmentReason: string;
}

export interface ModelAgreement {
  /** Top-1 季型是否一致。 */
  top1Match: boolean;
  /** Top-2 候选是否有重合。 */
  top2Overlap: boolean;
  /** CNN 第一名与第二名分数差。 */
  cnnTopGap: number;
  /** 豆包第一名与第二名分数差。 */
  doubaoTopGap: number;
  /** 融合结果第一名与第二名分数差。 */
  fusedTopGap: number;
  /** 两模型完整四分类分布的总变差距离，范围 0-1，主分布差异指标。 */
  totalVariationDistance: number;
  /** 分歧等级。 */
  level: "low" | "moderate" | "high";
}

export interface CandidateSeason {
  season: SeasonKey;
  score: number;
}

export interface AdvancedFusionDiagnosis extends FusionDiagnosis<"2.0"> {
  version: "2.0";
  /** 独立于季型名称的诊断可靠性状态。 */
  diagnosisStatus: DiagnosisStatus;
  /** 模型运行模式，与诊断状态分离，避免 DEGRADED 与 UNCERTAIN 互相覆盖。 */
  inferenceMode: InferenceMode;
  /** 图像质量评估结果。 */
  imageQuality: ImageQualityAssessment;
  /** 双模型一致性评估；单模型时为 null。 */
  modelAgreement: ModelAgreement | null;
  /** 动态权重调整明细。 */
  weightAdjustments: WeightAdjustment[];
  /** 造成不确定性的具体原因（机器可读短语）。 */
  uncertaintyReasons: string[];
  /**
   * 风险分层明细（Phase 3.2 新增）。
   * 旧记录缺失该字段时，调用方按 uncertaintyReasons 的兼容逻辑处理，不得因此报错。
   */
  risks?: DiagnosisRiskEntry[];
  /** 决定性风险原因（DECISIVE_RISK / BLOCKING_ISSUE）；旧记录缺失时视为空数组。 */
  decisiveReasons?: string[];
  /** 仅软警告（不阻止正式诊断，但仍需在结果与提示中保留）。 */
  softWarnings?: string[];
  /** 候选季型及分数（Top-1 / Top-2）。 */
  candidateSeasons: CandidateSeason[];
  /** 面向用户的改善建议。 */
  recommendations: string[];
  /** 当前分数/置信度的真实含义。 */
  confidenceType: ConfidenceType;
}

/** 判断是否为 v2 结构（老记录没有这些字段）。 */
export function isAdvancedFusionDiagnosis(value: unknown): value is AdvancedFusionDiagnosis {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === "2.0" && typeof record.diagnosisStatus === "string";
}
