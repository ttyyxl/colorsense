import {
  SEASON_KEYS,
  type Brightness,
  type FeatureContrast,
  type SeasonKey,
  type SeasonScores,
  type SkinUndertone,
  type Saturation,
  type VisionResult,
} from "./vision-schema.ts";
import type { VisionCallMeta, VisionUsage } from "./doubao-vision.ts";

/**
 * CNN + Doubao 固定权重融合（第一阶段实现）。
 *
 * 重要语义说明：
 * - CNN 的 scores 来自 torch.softmax，是模型输出概率；
 * - Doubao 的 season_scores 是视觉相对匹配评分，不是经过校准的概率。
 * 本模块只做「归一化后的固定权重线性融合」，融合分数不是统计意义上的校准置信度。
 *
 * 该文件是纯逻辑模块：不读取 Firebase，不发起任何 API 调用，不读取密钥。
 */

export { SEASON_KEYS } from "./vision-schema.ts";
export type { SeasonKey, SeasonScores, VisionResult } from "./vision-schema.ts";

export const FUSION_VERSION = "1.0" as const;
export const DEFAULT_CNN_WEIGHT = 0.4 as const;
/** 与 vision-schema.ts 的比较容差保持一致，保证并列处理的确定性。 */
const TIE_EPSILON = 1e-9;
const SCORE_PRECISION = 1e6;

export type FusionSource = "fusion" | "cnn" | "doubao";
export type FusionWeights = { cnn: number; doubao: number };

/** 机器可读的不可用/降级原因代码。不包含任何用户或模型原文。 */
export type FusionUnavailableCode =
  | "OK"
  | "FUSION_DISABLED"
  | "CNN_MISSING"
  | "CNN_UNSUPPORTED_SEASON"
  | "CNN_INVALID_SCORES"
  | "DOUBAO_MISSING"
  | "DOUBAO_MASTER_DISABLED"
  | "DOUBAO_CONFIG_MISSING"
  | "DOUBAO_FEATURE_DISABLED"
  | "DOUBAO_UNSUPPORTED_IMAGE_TYPE"
  | "DOUBAO_IMAGE_TOO_LARGE"
  | "DOUBAO_INVALID_IMAGE_DATA"
  | "DOUBAO_IMAGE_DIMENSIONS_TOO_LARGE"
  | "DOUBAO_AUTH_FAILED"
  | "DOUBAO_RATE_LIMITED"
  | "DOUBAO_TIMEOUT"
  | "DOUBAO_API_ERROR"
  | "DOUBAO_INVALID_RESPONSE"
  | "DOUBAO_UNRELIABLE"
  | "DOUBAO_INVALID_SCORES";

export interface FusionConfig {
  enabled: boolean;
  cnnWeight: number;
  doubaoWeight: number;
}

export class FusionConfigError extends Error {
  readonly code = "FUSION_CONFIG_INVALID" as const;
  constructor(message: string) {
    super(message);
    this.name = "FusionConfigError";
  }
}

/** 两个模型都没有可用结果时抛出；调用方必须返回明确的诊断失败。 */
export class FusionUnavailableError extends Error {
  readonly code = "ALL_MODELS_UNAVAILABLE" as const;
  readonly details: { cnn?: FusionUnavailableCode; doubao?: FusionUnavailableCode };
  constructor(details: { cnn?: FusionUnavailableCode; doubao?: FusionUnavailableCode }) {
    super("No usable season score from CNN or Doubao.");
    this.name = "FusionUnavailableError";
    this.details = details;
  }
}

/**
 * 读取服务端融合配置。权重非法时明确失败，不静默回退到错误权重。
 * FUSION_ENABLED=false 时完全保留第一阶段行为（不校验权重、不触发付费调用）。
 */
export function readFusionConfig(
  env: Record<string, string | undefined> = process.env,
): FusionConfig {
  const enabled = (env.FUSION_ENABLED ?? "false").trim().toLowerCase() === "true";
  if (!enabled) {
    return { enabled: false, cnnWeight: DEFAULT_CNN_WEIGHT, doubaoWeight: 1 - DEFAULT_CNN_WEIGHT };
  }

  const raw = env.FUSION_CNN_WEIGHT?.trim() ?? "";
  const cnnWeight = raw === "" ? DEFAULT_CNN_WEIGHT : Number(raw);
  if (!Number.isFinite(cnnWeight) || cnnWeight < 0 || cnnWeight > 1) {
    // 只回显变量名与“值非法”这一事实，不回显可能是密钥的配置内容。
    throw new FusionConfigError("FUSION_CNN_WEIGHT must be a finite number in [0, 1].");
  }
  return { enabled: true, cnnWeight, doubaoWeight: round(1 - cnnWeight) };
}

/**
 * 将 doubao-vision 的 VisionError.code / HTTP 状态映射为融合侧机器可读代码。
 * 通过鸭子类型读取 code/status，不在本模块引入 SDK 或完整错误原文。
 */
export function classifyVisionFailure(error: unknown): FusionUnavailableCode {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  const status = typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: unknown }).status
    : undefined;

  switch (code) {
    case "CONFIG_MISSING":
      return "DOUBAO_CONFIG_MISSING";
    case "FEATURE_DISABLED":
      return "DOUBAO_FEATURE_DISABLED";
    case "UNSUPPORTED_IMAGE_TYPE":
      return "DOUBAO_UNSUPPORTED_IMAGE_TYPE";
    case "IMAGE_TOO_LARGE":
      return "DOUBAO_IMAGE_TOO_LARGE";
    case "INVALID_IMAGE_DATA":
      return "DOUBAO_INVALID_IMAGE_DATA";
    case "IMAGE_DIMENSIONS_TOO_LARGE":
      return "DOUBAO_IMAGE_DIMENSIONS_TOO_LARGE";
    case "AUTH_FAILED":
      return "DOUBAO_AUTH_FAILED";
    case "RATE_LIMITED":
      return "DOUBAO_RATE_LIMITED";
    case "TIMEOUT":
      return "DOUBAO_TIMEOUT";
    case "API_ERROR":
    case "INVALID_RESPONSE":
      return code === "API_ERROR" ? "DOUBAO_API_ERROR" : "DOUBAO_INVALID_RESPONSE";
    default:
      break;
  }
  if (status === 429) return "DOUBAO_RATE_LIMITED";
  if (status === 401 || status === 403) return "DOUBAO_AUTH_FAILED";
  if (typeof status === "number" && status >= 500) return "DOUBAO_API_ERROR";
  return "DOUBAO_API_ERROR";
}

function round(value: number): number {
  return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION;
}

/** 确定性 argmax：容差内并列时取 SEASON_KEYS 中靠前的季型。 */
export function argmaxSeason(scores: SeasonScores): SeasonKey {
  let best: SeasonKey = SEASON_KEYS[0];
  for (const key of SEASON_KEYS) {
    if (scores[key] > scores[best] + TIE_EPSILON) best = key;
  }
  return best;
}

/**
 * 校验任意来源的四季评分并保留原始数值。
 * 要求四项齐全、有限且非负、总和大于 0；不使用预测标签补分，不伪造缺失季型。
 */
export function validateSeasonScores(raw: unknown): SeasonScores | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const values = {} as SeasonScores;

  for (const key of SEASON_KEYS) {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    values[key] = value;
  }

  const sum = SEASON_KEYS.reduce((acc, key) => acc + values[key], 0);
  if (!Number.isFinite(sum) || sum <= 0) return null;
  return values;
}

/**
 * 在校验通过的基础上把四季评分归一化到总和 1（保留 6 位小数并修正尾差）。
 */
export function normalizeSeasonScores(raw: unknown): SeasonScores | null {
  const values = validateSeasonScores(raw);
  if (!values) return null;

  const sum = SEASON_KEYS.reduce((acc, key) => acc + values[key], 0);
  const scores = {} as SeasonScores;
  for (const key of SEASON_KEYS) scores[key] = round(values[key] / sum);

  // 修正四舍五入造成的尾差，补给归一化前的最大分季型，保证四项之和精确为 1。
  const currentSum = SEASON_KEYS.reduce((acc, key) => acc + scores[key], 0);
  const drift = round(1 - currentSum);
  if (drift !== 0) {
    const originalMax = SEASON_KEYS.reduce((best, key) =>
      values[key] > values[best] + TIE_EPSILON ? key : best, SEASON_KEYS[0]);
    scores[originalMax] = round(scores[originalMax] + drift);
  }
  return scores;
}

export interface FusionResult {
  seasonScores: SeasonScores;
  predictedSeason: SeasonKey;
}

/**
 * 与 API 调用完全解耦的固定权重融合函数。
 *
 * @param cnnScores CNN  softmax 四季分数（允许未归一化）
 * @param doubaoScores Doubao 四季相对匹配分数（允许未归一化）
 * @param cnnWeight CNN 权重，默认 0.4；Doubao 权重为 1 - cnnWeight
 */
export function fuseSeasonScores(
  cnnScores: SeasonScores,
  doubaoScores: SeasonScores,
  cnnWeight: number = DEFAULT_CNN_WEIGHT,
): FusionResult {
  if (!Number.isFinite(cnnWeight) || cnnWeight < 0 || cnnWeight > 1) {
    throw new FusionConfigError("cnnWeight must be a finite number in [0, 1].");
  }
  const normalizedCnn = normalizeSeasonScores(cnnScores);
  const normalizedDoubao = normalizeSeasonScores(doubaoScores);
  if (!normalizedCnn || !normalizedDoubao) {
    throw new FusionUnavailableError({ cnn: normalizedCnn ? undefined : "CNN_INVALID_SCORES", doubao: normalizedDoubao ? undefined : "DOUBAO_INVALID_SCORES" });
  }

  const doubaoWeight = 1 - cnnWeight;
  const blended = {} as SeasonScores;
  for (const key of SEASON_KEYS) {
    blended[key] = cnnWeight * normalizedCnn[key] + doubaoWeight * normalizedDoubao[key];
  }
  const seasonScores = normalizeSeasonScores(blended);
  if (!seasonScores) {
    throw new FusionUnavailableError({ cnn: "CNN_INVALID_SCORES", doubao: "DOUBAO_INVALID_SCORES" });
  }
  return { seasonScores, predictedSeason: argmaxSeason(seasonScores) };
}

export interface CnnFusionInput {
  /** CNN top-1 标签，用于记录与一致性检查；融合分数仍来自四季 scores。 */
  season: string;
  /** 推理服务原始 scores，保留原始数值用于溯源。 */
  scores: unknown;
}

export interface DoubaoFusionInput {
  result: VisionResult;
  meta?: VisionCallMeta;
}

export interface BuildFusionDiagnosisInput {
  cnn: CnnFusionInput | null;
  doubao: DoubaoFusionInput | null;
  cnnWeight?: number;
  /** 单模型不可用时的机器可读原因代码。 */
  cnnCode?: FusionUnavailableCode;
  doubaoCode?: FusionUnavailableCode;
}

export type FusionDiagnosis = {
  version: typeof FUSION_VERSION;
  predictedSeason: SeasonKey;
  seasonScores: SeasonScores;
  source: FusionSource;
  requestedWeights: FusionWeights;
  effectiveWeights: FusionWeights;
  cnn: {
    available: boolean;
    predictedSeason?: SeasonKey;
    /** 推理服务返回的原始 softmax 数值，未做重新校准。 */
    seasonScores?: SeasonScores;
  };
  doubao: {
    available: boolean;
    predictedSeason?: SeasonKey;
    seasonScores?: SeasonScores;
    canJudgeReliably?: boolean;
    /** 字段名与枚举值严格对齐 VisionResult；拒判/失败时不提供。 */
    features?: {
      skin_undertone?: SkinUndertone;
      brightness?: Brightness;
      saturation?: Saturation;
      feature_contrast?: FeatureContrast;
    };
    lightingWarning?: boolean;
    filterWarning?: boolean;
    reason?: string;
  };
  fallbackReason: string | null;
  fallbackDetails?: { cnn?: FusionUnavailableCode; doubao?: FusionUnavailableCode };
  meta?: {
    doubaoModelId?: string;
    doubaoDurationMs?: number;
    doubaoUsage?: VisionUsage;
  };
};

/** VisionResult 的字段已经是严格枚举，这里只做重命名/拷贝，不生成缺失特征。 */
function toDoubaoFeatures(result: VisionResult): NonNullable<FusionDiagnosis["doubao"]["features"]> {
  return {
    skin_undertone: result.skin_undertone,
    brightness: result.brightness,
    saturation: result.saturation,
    feature_contrast: result.feature_contrast,
  };
}

/**
 * 根据两个模型的可用结果构造统一综合诊断。
 * 两者均不可用时抛出 FusionUnavailableError，不允许伪造季型。
 */
export function buildFusionDiagnosis(input: BuildFusionDiagnosisInput): FusionDiagnosis {
  const cnnWeight = input.cnnWeight ?? DEFAULT_CNN_WEIGHT;
  if (!Number.isFinite(cnnWeight) || cnnWeight < 0 || cnnWeight > 1) {
    throw new FusionConfigError("cnnWeight must be a finite number in [0, 1].");
  }
  const requestedWeights: FusionWeights = { cnn: cnnWeight, doubao: round(1 - cnnWeight) };

  const cnnSeason = input.cnn && isSeasonKey(input.cnn.season) ? input.cnn.season : undefined;
  const cnnDisplayScores = input.cnn ? validateSeasonScores(input.cnn.scores) : null;
  const cnnRawScores = input.cnn ? normalizeSeasonScores(input.cnn.scores) : null;
  const cnnUsable = Boolean(input.cnn && cnnSeason && cnnDisplayScores && cnnRawScores);
  // 有实际结果时以结果内容为准；input 的 code 只用于无结果（API 调用失败）的场景，
  // 避免上游传入的 "OK" 掩盖真实的拒判或非法分数。
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
      ? doubaoResult.can_judge_reliably !== true
        ? "DOUBAO_UNRELIABLE"
        : "DOUBAO_INVALID_SCORES"
      : input.doubaoCode ?? "DOUBAO_MISSING";

  const cnn: FusionDiagnosis["cnn"] = { available: cnnUsable };
  if (cnnUsable && cnnSeason && cnnDisplayScores) {
    // 保留推理服务返回的原始四季 softmax 数值（归一化仅用于融合计算）。
    cnn.predictedSeason = cnnSeason;
    cnn.seasonScores = cnnDisplayScores;
  }

  const doubao: FusionDiagnosis["doubao"] = { available: doubaoUsable };
  if (doubaoResult) {
    doubao.canJudgeReliably = doubaoResult.can_judge_reliably;
    doubao.lightingWarning = doubaoResult.lighting_warning;
    doubao.filterWarning = doubaoResult.filter_warning;
    doubao.reason = doubaoResult.reason;
    // 拒判/失败时不能对外提供色彩特征。
    if (doubaoUsable) {
      doubao.predictedSeason = doubaoResult.most_likely_season;
      doubao.seasonScores = doubaoDisplayScores ?? undefined;
      doubao.features = toDoubaoFeatures(doubaoResult);
    }
  }

  const base: Omit<FusionDiagnosis, "predictedSeason" | "seasonScores" | "source" | "effectiveWeights" | "fallbackReason"> = {
    version: FUSION_VERSION,
    requestedWeights,
    cnn,
    doubao,
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
  };

  if (cnnUsable && doubaoUsable && cnnRawScores && doubaoScores) {
    const fused = fuseSeasonScores(cnnRawScores, doubaoScores, cnnWeight);
    return {
      ...base,
      ...fused,
      source: "fusion",
      effectiveWeights: requestedWeights,
      fallbackReason: null,
    };
  }

  if (cnnUsable && cnnRawScores) {
    // Doubao 失败/拒判：回退纯 CNN。
    return {
      ...base,
      seasonScores: cnnRawScores,
      predictedSeason: argmaxSeason(cnnRawScores),
      source: "cnn",
      effectiveWeights: { cnn: 1, doubao: 0 },
      fallbackReason: doubaoCode,
    };
  }

  if (doubaoUsable && doubaoScores) {
    // CNN 无法提供合法四季分数时，使用已通过人脸质量校验流程的 Doubao 结果。
    return {
      ...base,
      seasonScores: doubaoScores,
      predictedSeason: argmaxSeason(doubaoScores),
      source: "doubao",
      effectiveWeights: { cnn: 0, doubao: 1 },
      fallbackReason: cnnCode,
    };
  }

  throw new FusionUnavailableError({ cnn: cnnCode, doubao: doubaoCode });
}

function isSeasonKey(value: unknown): value is SeasonKey {
  return typeof value === "string" && (SEASON_KEYS as readonly string[]).includes(value);
}
