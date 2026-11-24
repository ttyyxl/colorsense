import type { SeasonScores } from "./fusion.ts";
import {
  SCORE_TIE_EPSILON,
  UNCERTAINTY_THRESHOLDS as U,
  DIAGNOSIS_RISK_CLASSIFICATION,
  RISK_POLICY,
  type RiskClassification,
  type RiskPolicyConfig,
  type UncertaintyThresholds,
} from "./diagnosis-config.ts";
import type {
  DiagnosisRiskEntry,
  DiagnosisStatus,
  ImageQualityAssessment,
  InferenceMode,
  ModelAgreement,
} from "./diagnosis-types.ts";

/**
 * 诊断状态决策（与季型名称完全解耦）。
 *
 * 状态优先级（高 → 低）：
 * 1. RETAKE_REQUIRED：图像质量 REJECT。严重质量问题不能因为模型高分被忽略。
 * 2. FAILED：没有任何模型给出可用结果，不得生成季型。
 * 3. DEGRADED：**服务/模型不可用**导致的单模型降级；不确定性原因仍单独记录。
 * 4. UNCERTAIN：命中决定性风险，或命中多个相互独立的风险分组。
 * 5. CONFIDENT：满足当前诊断规则，可输出正式季型（可同时携带普通软警告）。
 *
 * inferenceMode 独立记录模型运行模式（dual / dual-refused / single-* / unavailable），
 * 与 diagnosisStatus 分开，避免 DEGRADED 与 UNCERTAIN 丢失信息。
 *
 * Phase 3.2 修复要点：
 * - 普通软警告（轻度色偏、光照提示、Top-1 不一致但分布接近）不再单独触发 UNCERTAIN；
 * - 豆包「主动拒判」（API 成功、模型明确不可靠）与「服务异常」彻底分离：
 *   前者进入 UNCERTAIN，后者才进入 DEGRADED。
 */

export interface DecideDiagnosisStatusInput {
  imageQuality: ImageQualityAssessment;
  cnnAvailable: boolean;
  doubaoAvailable: boolean;
  agreement: ModelAgreement | null;
  fusedScores: SeasonScores | null;
  doubao?: {
    canJudgeReliably?: boolean;
    lightingWarning?: boolean;
    filterWarning?: boolean;
  };
  /**
   * 豆包 API 调用成功，但模型明确表示当前照片无法支持可靠判断（主动拒判）。
   * 这与网络超时/鉴权失败等服务异常不同：请求本身成功，不应重试，也不应记为服务降级。
   */
  doubaoRefused?: boolean;
  /** 覆盖不确定性阈值；仅用于离线实验对照，生产默认取 UNCERTAINTY_THRESHOLDS。 */
  thresholds?: Partial<UncertaintyThresholds>;
  /** 覆盖风险策略；仅用于离线实验对照，生产默认取 RISK_POLICY。 */
  riskPolicy?: Partial<RiskPolicyConfig>;
}

export interface DiagnosisStatusDecision {
  status: DiagnosisStatus;
  inferenceMode: InferenceMode;
  /** 全部风险原因（决定性 + 软警告），保持与历史记录兼容。 */
  uncertaintyReasons: string[];
  /** 风险分层明细。 */
  risks: DiagnosisRiskEntry[];
  /** 决定性风险原因（进入 UNCERTAIN 的直接依据）。 */
  decisiveReasons: string[];
  /** 仅软警告（不阻止正式诊断）。 */
  softWarnings: string[];
  recommendations: string[];
}

function topTwo(scores: SeasonScores): { top: number; second: number } {
  const values = Object.values(scores).sort((a, b) => b - a);
  return { top: values[0] ?? 0, second: values[1] ?? 0 };
}

function below(value: number, threshold: number): boolean {
  return value <= threshold + SCORE_TIE_EPSILON;
}

function classificationOf(reason: string): RiskClassification {
  const known = (DIAGNOSIS_RISK_CLASSIFICATION as Record<string, RiskClassification | undefined>)[reason];
  // 未登记的原因默认按决定性风险处理：宁可保留不确定性，也不要静默放过未知风险。
  return known ?? { level: "DECISIVE_RISK", group: "unclassified", domain: "model", escalates: false };
}

export function decideDiagnosisStatus(input: DecideDiagnosisStatusInput): DiagnosisStatusDecision {
  const { imageQuality } = input;
  const thresholds: UncertaintyThresholds = { ...U, ...input.thresholds };
  const policy: RiskPolicyConfig = { ...RISK_POLICY, ...input.riskPolicy };
  const risks: DiagnosisRiskEntry[] = [];
  const recommendations = [...imageQuality.recommendation];

  const addRisk = (reason: string): void => {
    const { level, group } = classificationOf(reason);
    risks.push({ reason, level, group });
  };

  const doubaoRefused = input.doubaoRefused === true;
  const refusalOnly = doubaoRefused && input.cnnAvailable && !input.doubaoAvailable;

  const inferenceMode: InferenceMode = policy.mode === "legacy" && refusalOnly
    ? "single-cnn"
    : refusalOnly
      ? "dual-refused"
      : input.cnnAvailable && input.doubaoAvailable
        ? "dual"
        : input.cnnAvailable
          ? "single-cnn"
          : input.doubaoAvailable
            ? "single-doubao"
            : "unavailable";

  // 1. 图像质量 REJECT 优先级最高，且不受模型分数影响。
  if (imageQuality.qualityLevel === "REJECT") {
    addRisk("IMAGE_QUALITY_REJECT");
    return {
      status: "RETAKE_REQUIRED",
      inferenceMode,
      uncertaintyReasons: ["IMAGE_QUALITY_REJECT"],
      risks,
      decisiveReasons: ["IMAGE_QUALITY_REJECT"],
      softWarnings: [],
      recommendations,
    };
  }

  // 2. 两模型均不可用 → FAILED，不生成季型。
  if (!input.cnnAvailable && !input.doubaoAvailable) {
    addRisk("ALL_MODELS_UNAVAILABLE");
    return {
      status: "FAILED",
      inferenceMode: "unavailable",
      uncertaintyReasons: ["ALL_MODELS_UNAVAILABLE"],
      risks,
      decisiveReasons: ["ALL_MODELS_UNAVAILABLE"],
      softWarnings: [],
      recommendations,
    };
  }

  // 普通软警告：保留提示，但不单独阻止正式诊断。
  if (imageQuality.qualityLevel === "WARNING") addRisk("IMAGE_QUALITY_WARNING");
  if (input.doubao?.lightingWarning === true) addRisk("DOUBAO_LIGHTING_WARNING");
  if (input.doubao?.filterWarning === true) addRisk("DOUBAO_FILTER_WARNING");
  // 豆包主动拒判：模型明确表示无法支持可靠判断（不是服务故障）。
  if (doubaoRefused) addRisk(policy.mode === "legacy" ? "DOUBAO_UNRELIABLE" : "DOUBAO_REFUSED");

  // 图像质量 issue 级风险：把「轻微色偏」「轻度模糊」「严重颜色分布异常」等
  // 具体问题各自归类，而不是只用一个笼统的 IMAGE_QUALITY_WARNING。
  // legacy 策略刻意不展开 issue 列表，以精确复现 Phase 3.1 的原因集合。
  if (policy.mode !== "legacy") {
    for (const issue of imageQuality.issues) {
      if (issue.severity === "critical") continue; // 阻断级 issue 已由 REJECT 分支处理
      if (issue.code === "IMAGE_QUALITY_WARNING") continue;
      addRisk(issue.code);
    }
  }

  // 3. 单模型降级：**服务不可用**（网络异常/禁用/配置缺失等）才走 DEGRADED。
  if (inferenceMode === "single-cnn" || inferenceMode === "single-doubao") {
    addRisk("SINGLE_MODEL_DEGRADED");
    if (input.fusedScores) {
      const { top, second } = topTwo(input.fusedScores);
      if (below(top, thresholds.minTopScore)) addRisk("TOP_SCORE_BELOW_THRESHOLD");
      if (below(top - second, thresholds.minTopGap)) addRisk("TOP_GAP_BELOW_THRESHOLD");
    }
    if (input.agreement?.cnnTopGap !== undefined && below(input.agreement.cnnTopGap, thresholds.minModelTopGap) && input.cnnAvailable) {
      addRisk("CNN_LOW_DISCRIMINATION");
    }
    if (input.agreement?.doubaoTopGap !== undefined && below(input.agreement.doubaoTopGap, thresholds.minModelTopGap) && input.doubaoAvailable) {
      addRisk("DOUBAO_LOW_DISCRIMINATION");
    }
    if (!recommendations.some((item) => item.includes("不确定性"))) {
      recommendations.push("本次仅使用单一模型分析，结果存在局限；建议在自然光下重新上传清晰正面照以完成双模型诊断。");
    }
    return {
      status: "DEGRADED",
      inferenceMode,
      uncertaintyReasons: risks.map((risk) => risk.reason),
      risks,
      decisiveReasons: risks.filter((risk) => risk.level === "DECISIVE_RISK").map((risk) => risk.reason),
      softWarnings: risks.filter((risk) => risk.level === "SOFT_WARNING").map((risk) => risk.reason),
      recommendations,
    };
  }

  // 4. 双模型（或豆包主动拒判但 CNN 可用）时的分数与分歧判断。
  if (input.fusedScores) {
    const { top, second } = topTwo(input.fusedScores);
    if (below(top, thresholds.minTopScore)) addRisk("TOP_SCORE_BELOW_THRESHOLD");
    if (below(top - second, thresholds.minTopGap)) addRisk("TOP_GAP_BELOW_THRESHOLD");
  }
  if (input.agreement) {
    if (!input.agreement.top1Match) addRisk("MODEL_TOP1_MISMATCH");
    if (input.agreement.totalVariationDistance >= thresholds.totalVariationDistance) {
      addRisk("MODEL_DISTRIBUTION_DISAGREEMENT");
    }
    if (below(input.agreement.cnnTopGap, thresholds.minModelTopGap)) addRisk("CNN_LOW_DISCRIMINATION");
    if (below(input.agreement.doubaoTopGap, thresholds.minModelTopGap)) addRisk("DOUBAO_LOW_DISCRIMINATION");
  }

  // 5. 判定决定性风险。
  //    - layered：任一 DECISIVE_RISK 即成立；软警告需同时出现「图像侧」与
  //      「模型侧」两类相互独立的风险才升级，避免多条相关警告制造虚假高风险。
  //    - legacy：复现 Phase 3.1 规则（除 MODEL_TOP1_MISMATCH 外任何原因都算决定性）。
  const softWarningGroups = new Set(
    risks.filter((risk) => risk.level === "SOFT_WARNING").map((risk) => risk.group),
  );
  const escalatingDomains = new Set(
    risks
      .filter((risk) => risk.level === "SOFT_WARNING" && classificationOf(risk.reason).escalates)
      .map((risk) => classificationOf(risk.reason).domain),
  );
  const decisiveReasons = policy.mode === "legacy"
    ? risks.filter((risk) => risk.reason !== "MODEL_TOP1_MISMATCH").map((risk) => risk.reason)
    : risks.filter((risk) => risk.level === "DECISIVE_RISK").map((risk) => risk.reason);

  if (policy.mode === "layered"
    && escalatingDomains.has("image")
    && escalatingDomains.has("model")
    && softWarningGroups.size >= policy.softWarningGroupsToEscalate) {
    addRisk("MULTIPLE_INDEPENDENT_RISKS");
    decisiveReasons.push("MULTIPLE_INDEPENDENT_RISKS");
  }

  const status: DiagnosisStatus = decisiveReasons.length > 0 ? "UNCERTAIN" : "CONFIDENT";
  if (status === "UNCERTAIN" && !recommendations.some((item) => item.includes("不确定性"))) {
    recommendations.push("本次诊断结果存在不确定性，建议在自然光下重新拍摄清晰正面照后再次诊断。");
  }
  if (doubaoRefused && policy.mode === "layered" && !recommendations.some((item) => item.includes("视觉模型"))) {
    recommendations.push("视觉模型已返回结果，但明确表示当前照片无法支持可靠判断；建议关闭滤镜与美颜、在均匀自然光下重新拍摄。");
  }

  return {
    status,
    inferenceMode,
    uncertaintyReasons: risks.map((risk) => risk.reason),
    risks,
    decisiveReasons,
    softWarnings: risks.filter((risk) => risk.level === "SOFT_WARNING").map((risk) => risk.reason),
    recommendations,
  };
}
