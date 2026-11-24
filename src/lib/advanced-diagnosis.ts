import {
  argmaxSeason,
  DEFAULT_CNN_WEIGHT,
  normalizeSeasonScores,
  FusionConfigError,
  FusionUnavailableError,
  SEASON_KEYS,
  validateSeasonScores,
  type CnnFusionInput,
  type DoubaoFusionInput,
  type FusionSource,
  type FusionUnavailableCode,
  type SeasonKey,
  type SeasonScores,
} from "./fusion.ts";
import { SEASON_ORDER as AGREEMENT_KEYS } from "./diagnosis-config.ts";
import type { RiskPolicyConfig, UncertaintyThresholds } from "./diagnosis-config.ts";
import { evaluateModelAgreement } from "./agreement.ts";
import { decideDiagnosisStatus } from "./diagnosis-status.ts";
import { computeEffectiveWeights, type WeightFactors } from "./weighting.ts";
import type {
  AdvancedFusionDiagnosis,
  CandidateSeason,
  ConfidenceType,
  DiagnosisRiskEntry,
  ImageQualityAssessment,
} from "./diagnosis-types.ts";

/**
 * 第三阶段综合诊断编排（纯逻辑，不访问网络/数据库/密钥）。
 *
 * 流程：图像质量（外部评估）→ 模型可用性 → 动态权重 → 四季融合 →
 *       模型分歧 → 诊断状态 → v2 结果。
 *
 * RETAKE_REQUIRED / FAILED 不生成 fusion 结果（不产生可被误用的季型）。
 * UNCERTAIN / DEGRADED 生成带状态的候选结果，供前端差异化展示。
 */

export interface ReliabilityInput {
  cnn?: { value: number; reason: string };
  doubao?: { value: number; reason: string };
}

export interface AdvancedDiagnosisInput {
  cnn: CnnFusionInput | null;
  doubao: DoubaoFusionInput | null;
  cnnCode?: FusionUnavailableCode;
  doubaoCode?: FusionUnavailableCode;
  /** 用户配置的基准 CNN 权重；默认 0.4。requestedWeights 不被动态算法改写。 */
  cnnWeight?: number;
  imageQuality: ImageQualityAssessment;
  /** 已验证的模型可靠性系数；默认中性 1，禁止伪造实验结果。 */
  reliability?: ReliabilityInput;
  /** 覆盖不确定性阈值；仅用于离线实验对照，生产默认取 UNCERTAINTY_THRESHOLDS。 */
  thresholds?: Partial<UncertaintyThresholds>;
  /** 覆盖风险策略；仅用于离线实验对照，生产默认取 RISK_POLICY。 */
  riskPolicy?: Partial<RiskPolicyConfig>;
}

export interface AdvancedDiagnosisResult {
  fusion: AdvancedFusionDiagnosis | null;
  diagnosisStatus: AdvancedFusionDiagnosis["diagnosisStatus"];
  inferenceMode: AdvancedFusionDiagnosis["inferenceMode"];
  uncertaintyReasons: string[];
  /** 风险分层明细。 */
  risks: DiagnosisRiskEntry[];
  /** 决定性风险原因。 */
  decisiveReasons: string[];
  /** 仅软警告（不阻止正式诊断）。 */
  softWarnings: string[];
  recommendations: string[];
  /** 无法生成诊断时返回机器可读状态，不返回虚假季型。 */
  blockedCode?: "IMAGE_QUALITY_REJECT" | "ALL_MODELS_UNAVAILABLE";
}

function isSeasonKey(value: unknown): value is SeasonKey {
  return typeof value === "string" && (SEASON_KEYS as readonly string[]).includes(value);
}

function toDoubaoFeatures(result: NonNullable<DoubaoFusionInput>["result"]): NonNullable<AdvancedFusionDiagnosis["doubao"]["features"]> {
  return {
    skin_undertone: result.skin_undertone,
    brightness: result.brightness,
    saturation: result.saturation,
    feature_contrast: result.feature_contrast,
  };
}

function candidatesFrom(scores: SeasonScores): CandidateSeason[] {
  return [...AGREEMENT_KEYS]
    .map((season) => ({ season, score: scores[season] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

/**
 * 构建第三阶段诊断结果。返回 blocked 状态时 fusion 为 null。
 */
export function buildAdvancedDiagnosis(input: AdvancedDiagnosisInput): AdvancedDiagnosisResult {
  const baseCnnWeight = input.cnnWeight ?? DEFAULT_CNN_WEIGHT;
  if (!Number.isFinite(baseCnnWeight) || baseCnnWeight < 0 || baseCnnWeight > 1) {
    throw new FusionConfigError("cnnWeight must be a finite number in [0, 1].");
  }
  const requestedWeights = { cnn: baseCnnWeight, doubao: Math.round((1 - baseCnnWeight) * 1e6) / 1e6 };

  const imageQuality = input.imageQuality;

  // 1. 图像质量 REJECT：不进入正式诊断，不生成季型。
  if (imageQuality.qualityLevel === "REJECT") {
    return {
      fusion: null,
      diagnosisStatus: "RETAKE_REQUIRED",
      inferenceMode:
        input.cnn && input.doubao ? "dual"
          : input.cnn ? "single-cnn"
            : input.doubao ? "single-doubao" : "unavailable",
      uncertaintyReasons: ["IMAGE_QUALITY_REJECT"],
      risks: [{ reason: "IMAGE_QUALITY_REJECT", level: "BLOCKING_ISSUE", group: "blocking" }],
      decisiveReasons: ["IMAGE_QUALITY_REJECT"],
      softWarnings: [],
      recommendations: [...imageQuality.recommendation],
      blockedCode: "IMAGE_QUALITY_REJECT",
    };
  }

  // 2. 校验两个模型分数，只有合法结果才视为可用。
  const cnnSeason = input.cnn && isSeasonKey(input.cnn.season) ? input.cnn.season : undefined;
  const cnnDisplayScores = input.cnn ? validateSeasonScores(input.cnn.scores) : null;
  const cnnRawScores = input.cnn ? normalizeSeasonScores(input.cnn.scores) : null;
  const cnnUsable = Boolean(input.cnn && cnnSeason && cnnDisplayScores && cnnRawScores);
  const cnnCode: FusionUnavailableCode = cnnUsable
    ? "OK"
    : input.cnn
      ? isSeasonKey(input.cnn.season) ? "CNN_INVALID_SCORES" : "CNN_UNSUPPORTED_SEASON"
      : input.cnnCode ?? "CNN_MISSING";

  const doubaoResult = input.doubao?.result;
  const doubaoDisplayScores = doubaoResult ? validateSeasonScores(doubaoResult.season_scores) : null;
  const doubaoScores = doubaoResult ? normalizeSeasonScores(doubaoResult.season_scores) : null;
  const doubaoUsable = Boolean(
    doubaoResult &&
    doubaoResult.can_judge_reliably === true &&
    isSeasonKey(doubaoResult.most_likely_season) &&
    doubaoScores,
  );
  const doubaoCode: FusionUnavailableCode = doubaoUsable
    ? "OK"
    : doubaoResult
      ? doubaoResult.can_judge_reliably !== true ? "DOUBAO_UNRELIABLE" : "DOUBAO_INVALID_SCORES"
      : input.doubaoCode ?? "DOUBAO_MISSING";

  // 3. 两模型均不可用 → FAILED，不生成季型。
  if (!cnnUsable && !doubaoUsable) {
    return {
      fusion: null,
      diagnosisStatus: "FAILED",
      inferenceMode: "unavailable",
      uncertaintyReasons: ["ALL_MODELS_UNAVAILABLE"],
      risks: [{ reason: "ALL_MODELS_UNAVAILABLE", level: "BLOCKING_ISSUE", group: "blocking" }],
      decisiveReasons: ["ALL_MODELS_UNAVAILABLE"],
      softWarnings: [],
      recommendations: [...imageQuality.recommendation, "两个模型均无法给出有效评分，请上传光线更合适的正面照片后重试。"],
      blockedCode: "ALL_MODELS_UNAVAILABLE",
    };
  }

  // 4. 动态权重：可用性来自上面校验；适用性默认中性 1（无验证依据不转移权重）；
  //    可靠性系数仅在调用方提供已验证数据时启用，默认中性 1。
  const cnnFactors: WeightFactors = {
    available: cnnUsable,
    applicability: 1,
    reliability: input.reliability?.cnn?.value,
    reliabilityReason: input.reliability?.cnn?.reason,
  };
  const doubaoFactors: WeightFactors = {
    available: doubaoUsable,
    applicability: 1,
    reliability: input.reliability?.doubao?.value,
    reliabilityReason: input.reliability?.doubao?.reason,
  };
  const weights = computeEffectiveWeights({ requestedWeights, cnn: cnnFactors, doubao: doubaoFactors });
  if (!weights.normalized) {
    return {
      fusion: null,
      diagnosisStatus: "FAILED",
      inferenceMode: "unavailable",
      uncertaintyReasons: ["WEIGHT_NORMALIZATION_FAILED"],
      risks: [{ reason: "WEIGHT_NORMALIZATION_FAILED", level: "BLOCKING_ISSUE", group: "blocking" }],
      decisiveReasons: ["WEIGHT_NORMALIZATION_FAILED"],
      softWarnings: [],
      recommendations: ["本次诊断无法计算有效模型权重，请重新上传照片后重试。"],
      blockedCode: "ALL_MODELS_UNAVAILABLE",
    };
  }

  // 5. 四季融合：单模型时直接取其归一化分数；双模型时按 effectiveWeights 融合。
  let seasonScores: SeasonScores;
  let source: FusionSource;
  let fallbackReason: string | null;
  let scoreBasis: SeasonScores;
  if (cnnUsable && doubaoUsable && cnnRawScores && doubaoScores) {
    const cnnShare = weights.effectiveWeights.cnn;
    const blended = {} as SeasonScores;
    for (const key of SEASON_KEYS) {
      blended[key] = cnnShare * cnnRawScores[key] + weights.effectiveWeights.doubao * doubaoScores[key];
    }
    const normalized = normalizeSeasonScores(blended);
    if (!normalized) throw new FusionUnavailableError({ cnn: "CNN_INVALID_SCORES", doubao: "DOUBAO_INVALID_SCORES" });
    seasonScores = normalized;
    scoreBasis = normalized;
    source = "fusion";
    fallbackReason = null;
  } else if (cnnUsable && cnnRawScores) {
    seasonScores = cnnRawScores;
    scoreBasis = cnnRawScores;
    source = "cnn";
    fallbackReason = doubaoCode;
  } else if (doubaoUsable && doubaoScores) {
    seasonScores = doubaoScores;
    scoreBasis = doubaoScores;
    source = "doubao";
    fallbackReason = cnnCode;
  } else {
    return {
      fusion: null,
      diagnosisStatus: "FAILED",
      inferenceMode: "unavailable",
      uncertaintyReasons: ["ALL_MODELS_UNAVAILABLE"],
      risks: [{ reason: "ALL_MODELS_UNAVAILABLE", level: "BLOCKING_ISSUE", group: "blocking" }],
      decisiveReasons: ["ALL_MODELS_UNAVAILABLE"],
      softWarnings: [],
      recommendations: ["两个模型均无法给出有效评分，请重新上传照片后重试。"],
      blockedCode: "ALL_MODELS_UNAVAILABLE",
    };
  }
  const predictedSeason = argmaxSeason(seasonScores);

  // 6. 模型分歧（单模型时无分布差异可比）。
  const agreement = cnnUsable && doubaoUsable && cnnRawScores && doubaoScores
    ? evaluateModelAgreement(cnnRawScores, doubaoScores, scoreBasis, input.thresholds)
    : null;

  // 6.1 豆包主动拒判：API 调用成功但模型明确表示无法支持可靠判断。
  //     与网络/服务异常分离——不重试、不记为服务降级、不得生成正式季型。
  const doubaoRefused = Boolean(doubaoResult && doubaoResult.can_judge_reliably === false);

  // 7. 状态决策。
  const decision = decideDiagnosisStatus({
    imageQuality,
    cnnAvailable: cnnUsable,
    doubaoAvailable: doubaoUsable,
    agreement,
    fusedScores: scoreBasis,
    doubao: doubaoResult
      ? {
          canJudgeReliably: doubaoResult.can_judge_reliably,
          lightingWarning: doubaoResult.lighting_warning,
          filterWarning: doubaoResult.filter_warning,
        }
      : undefined,
    doubaoRefused,
    thresholds: input.thresholds,
    riskPolicy: input.riskPolicy,
  });

  // 8. 组装 v2 结果（保留 v1 全部字段）。
  const confidenceType: ConfidenceType = source === "fusion"
    ? "uncalibrated_fusion_score"
    : "uncalibrated_single_model_score";

  const cnn: AdvancedFusionDiagnosis["cnn"] = { available: cnnUsable };
  if (cnnUsable && cnnSeason && cnnDisplayScores) {
    cnn.predictedSeason = cnnSeason;
    cnn.seasonScores = cnnDisplayScores;
  }
  const doubao: AdvancedFusionDiagnosis["doubao"] = { available: doubaoUsable };
  if (doubaoResult) {
    doubao.canJudgeReliably = doubaoResult.can_judge_reliably;
    doubao.lightingWarning = doubaoResult.lighting_warning;
    doubao.filterWarning = doubaoResult.filter_warning;
    doubao.reason = doubaoResult.reason;
    if (doubaoUsable && isSeasonKey(doubaoResult.most_likely_season)) {
      doubao.predictedSeason = doubaoResult.most_likely_season;
      doubao.seasonScores = doubaoDisplayScores ?? undefined;
      doubao.features = toDoubaoFeatures(doubaoResult);
    }
  }

  const fusion: AdvancedFusionDiagnosis = {
    version: "2.0",
    predictedSeason,
    seasonScores,
    source,
    requestedWeights,
    effectiveWeights: weights.effectiveWeights,
    cnn,
    doubao,
    fallbackReason,
    fallbackDetails: { cnn: cnnCode, doubao: doubaoCode },
    ...(input.doubao?.meta
      ? {
          meta: {
            doubaoModelId: input.doubao.meta.modelId,
            doubaoDurationMs: input.doubao.meta.durationMs,
            doubaoUsage: input.doubao.meta.usage,
          },
        }
      : {}),
    diagnosisStatus: decision.status,
    inferenceMode: decision.inferenceMode,
    imageQuality,
    modelAgreement: agreement,
    weightAdjustments: weights.adjustments,
    uncertaintyReasons: decision.uncertaintyReasons,
    risks: decision.risks,
    decisiveReasons: decision.decisiveReasons,
    softWarnings: decision.softWarnings,
    candidateSeasons: candidatesFrom(scoreBasis),
    recommendations: decision.recommendations,
    confidenceType,
  };

  return {
    fusion,
    diagnosisStatus: decision.status,
    inferenceMode: decision.inferenceMode,
    uncertaintyReasons: decision.uncertaintyReasons,
    risks: decision.risks,
    decisiveReasons: decision.decisiveReasons,
    softWarnings: decision.softWarnings,
    recommendations: decision.recommendations,
  };
}
