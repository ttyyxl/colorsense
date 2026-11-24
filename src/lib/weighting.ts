import { FusionConfigError, type FusionWeights } from "./fusion.ts";
import { WEIGHT_LIMITS } from "./diagnosis-config.ts";
import type { EffectiveWeightsResult, WeightAdjustment } from "./diagnosis-types.ts";

/**
 * 可解释、可测试的动态权重框架。
 *
 * 计算公式（每个模型）：
 *   原始权重 = 基准权重 × 模型可用性 × 模型适用性系数 × 已验证可靠性系数
 * 随后对两个原始权重归一化，使实际权重之和为 1。
 *
 * 重要约束：
 * - 适用性系数与可靠性系数**默认均为中性值 1**。项目当前没有经过独立验证集验证的
 *   模型可靠性数据，禁止把人为设定的系数伪装成真实实验结果。
 * - 用户显式设置为 0 的基准权重不得被恢复。
 * - 模型不可用 → 有效权重为 0；两模型均不可用或基准权重总和为 0 → 不归一化。
 * - 用户配置保持不变（requestedWeights 不被改写），只输出 effectiveWeights。
 * - 两模型均可用时的权重调整受 WEIGHT_LIMITS.maxShiftPerModel 限制。
 */

export interface WeightFactors {
  /** 模型是否成功返回合法结果。 */
  available: boolean;
  /** 模型适用性系数（如图像质量对某模型的影响）。默认 1；只有有明确依据时才允许非 1。 */
  applicability?: number;
  applicabilityReason?: string;
  /** 已验证可靠性系数。默认 1；必须来自独立验证集，不得伪造。 */
  reliability?: number;
  reliabilityReason?: string;
}

export interface ComputeEffectiveWeightsInput {
  requestedWeights: FusionWeights;
  cnn: WeightFactors;
  doubao: WeightFactors;
}

function isValidWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function factorOf(value: number | undefined, label: string): number {
  if (value === undefined) return 1;
  // 系数本身允许任意非负有限数（如已验证准确率之比）；最终权重调整幅度由 clamp 控制。
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new FusionConfigError(`${label} must be a finite number >= 0.`);
  }
  return value;
}

/**
 * 计算本次诊断的实际权重。返回 normalized=false 时调用方必须进入不可诊断状态，
 * 不得自行补 0 或强制归一化。
 */
export function computeEffectiveWeights(input: ComputeEffectiveWeightsInput): EffectiveWeightsResult {
  const { requestedWeights } = input;
  if (!isValidWeight(requestedWeights.cnn) || !isValidWeight(requestedWeights.doubao)) {
    throw new FusionConfigError("requestedWeights must be finite numbers in [0, 1].");
  }

  const baseSum = requestedWeights.cnn + requestedWeights.doubao;
  if (baseSum <= WEIGHT_LIMITS.sumTolerance) {
    return {
      requestedWeights: { ...requestedWeights },
      effectiveWeights: { cnn: 0, doubao: 0 },
      normalized: false,
      available: { cnn: input.cnn.available, doubao: input.doubao.available },
      adjustments: [{
        model: "cnn",
        stage: "normalize",
        factor: 0,
        reason: "REQUESTED_WEIGHTS_SUM_ZERO",
      }],
      adjustmentReason: "基准权重总和为 0，参数异常；未执行归一化，未发生除零。",
    };
  }

  const adjustments: WeightAdjustment[] = [];
  const models = ["cnn", "doubao"] as const;
  const factors: Record<"cnn" | "doubao", { availability: number; applicability: number; reliability: number }> = {
    cnn: {
      availability: input.cnn.available ? 1 : 0,
      applicability: factorOf(input.cnn.applicability, "cnn.applicability"),
      reliability: factorOf(input.cnn.reliability, "cnn.reliability"),
    },
    doubao: {
      availability: input.doubao.available ? 1 : 0,
      applicability: factorOf(input.doubao.applicability, "doubao.applicability"),
      reliability: factorOf(input.doubao.reliability, "doubao.reliability"),
    },
  };

  const raw: Record<"cnn" | "doubao", number> = { cnn: 0, doubao: 0 };
  for (const model of models) {
    const base = requestedWeights[model];
    const factorSet = factors[model];

    if (factorSet.availability === 0) {
      adjustments.push({
        model,
        stage: "availability",
        factor: 0,
        reason: "MODEL_UNAVAILABLE",
      });
    }
    if (factorSet.applicability !== 1) {
      adjustments.push({
        model,
        stage: "applicability",
        factor: factorSet.applicability,
        reason: (model === "cnn" ? input.cnn.applicabilityReason : input.doubao.applicabilityReason) ?? "IMAGE_APPLICABILITY_ADJUSTED",
      });
    }
    if (factorSet.reliability !== 1) {
      adjustments.push({
        model,
        stage: "reliability",
        factor: factorSet.reliability,
        reason: (model === "cnn" ? input.cnn.reliabilityReason : input.doubao.reliabilityReason) ?? "VALIDATED_RELIABILITY_ADJUSTED",
      });
    }

    // 用户显式置 0 的权重始终是 0，任何系数都不能把它恢复为非 0。
    raw[model] = base === 0
      ? 0
      : base * factorSet.availability * factorSet.applicability * factorSet.reliability;
  }

  const rawSum = raw.cnn + raw.doubao;
  if (!Number.isFinite(rawSum) || rawSum <= WEIGHT_LIMITS.sumTolerance) {
    adjustments.push({ model: "cnn", stage: "normalize", factor: 0, reason: "NO_USABLE_MODEL_WEIGHT" });
    return {
      requestedWeights: { ...requestedWeights },
      effectiveWeights: { cnn: 0, doubao: 0 },
      normalized: false,
      available: { cnn: input.cnn.available, doubao: input.doubao.available },
      adjustments,
      adjustmentReason: "没有可用模型权重；未执行归一化，进入不可诊断状态。",
    };
  }

  let effective: FusionWeights = {
    cnn: round(raw.cnn / rawSum),
    doubao: round(raw.doubao / rawSum),
  };

  // 两模型均可用且基准权重均非 0 时，限制相对基准的调整幅度，避免未经验证的指标导致剧烈变化。
  if (input.cnn.available && input.doubao.available && requestedWeights.cnn > 0 && requestedWeights.doubao > 0) {
    const shift = WEIGHT_LIMITS.maxShiftPerModel;
    for (let pass = 0; pass < 2; pass += 1) {
      let changed = false;
      for (const model of models) {
        const base = requestedWeights[model];
        const lower = Math.max(0, base - shift);
        const upper = Math.min(1, base + shift);
        if (effective[model] < lower) {
          effective[model] = round(lower);
          changed = true;
        } else if (effective[model] > upper) {
          effective[model] = round(upper);
          changed = true;
        }
      }
      if (!changed) break;
      const total = effective.cnn + effective.doubao;
      if (total > 0) {
        effective = { cnn: round(effective.cnn / total), doubao: round(effective.doubao / total) };
      }
    }
    const clamped = models.some((model) =>
      Math.abs(effective[model] - requestedWeights[model]) > shift + WEIGHT_LIMITS.sumTolerance);
    if (clamped) {
      adjustments.push({ model: "cnn", stage: "clamp", factor: 1, reason: "WEIGHT_SHIFT_CLAMPED" });
    }
  }

  // 归一化后和为 1；用户零权重保持为 0。
  const total = effective.cnn + effective.doubao;
  if (total <= 0 || !Number.isFinite(total)) {
    return {
      requestedWeights: { ...requestedWeights },
      effectiveWeights: { cnn: 0, doubao: 0 },
      normalized: false,
      available: { cnn: input.cnn.available, doubao: input.doubao.available },
      adjustments,
      adjustmentReason: "归一化失败；未生成可用权重。",
    };
  }
  if (Math.abs(total - 1) > WEIGHT_LIMITS.sumTolerance) {
    effective = { cnn: round(effective.cnn / total), doubao: round(effective.doubao / total) };
  }
  effective.cnn = requestedWeights.cnn === 0 ? 0 : effective.cnn;
  effective.doubao = requestedWeights.doubao === 0 ? 0 : effective.doubao;

  const hasAdjustment = adjustments.length > 0;
  if (!hasAdjustment) {
    adjustments.push({
      model: "cnn",
      stage: "normalize",
      factor: 1,
      reason: "KEEP_BASELINE_NO_VALIDATED_BASIS",
    });
  }
  adjustments.push({ model: "cnn", stage: "normalize", factor: 1, reason: "NORMALIZED_TO_ONE" });

  return {
    requestedWeights: { ...requestedWeights },
    effectiveWeights: effective,
    normalized: true,
    available: { cnn: input.cnn.available, doubao: input.doubao.available },
    adjustments,
    adjustmentReason: hasAdjustment
      ? "依据模型可用性与已提供系数调整后归一化；未使用未经验证的模型优劣假设。"
      : "两个模型均可用且缺乏充分调整依据，保持用户基准权重并归一化。",
  };
}
