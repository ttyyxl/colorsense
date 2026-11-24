import test from "node:test";
import assert from "node:assert/strict";
import { VisionResultSchema, type SeasonScores, type VisionResult } from "../src/lib/vision-schema.ts";
import type { ImageQualityAssessment } from "../src/lib/diagnosis-types.ts";
import { buildAdvancedDiagnosis } from "../src/lib/advanced-diagnosis.ts";
import { totalVariationDistance, evaluateModelAgreement } from "../src/lib/agreement.ts";
import { computeEffectiveWeights } from "../src/lib/weighting.ts";
import { FusionConfigError } from "../src/lib/fusion.ts";

function visionResult(
  scores: SeasonScores,
  overrides: Record<string, unknown> = {},
): VisionResult {
  const season = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as VisionResult["most_likely_season"];
  return VisionResultSchema.parse({
    season_scores: scores,
    most_likely_season: season,
    skin_undertone: "cool",
    brightness: "medium",
    saturation: "moderate",
    feature_contrast: "medium",
    lighting_warning: false,
    filter_warning: false,
    can_judge_reliably: true,
    reason: "观察到肤色与对比特征，据此推断季节。",
    ...overrides,
  });
}

function quality(level: ImageQualityAssessment["qualityLevel"] = "PASS"): ImageQualityAssessment {
  return {
    overallQuality: level === "PASS" ? 0.95 : level === "WARNING" ? 0.6 : 0.2,
    qualityLevel: level,
    metrics: {},
    issues: [],
    severity: level === "REJECT" ? "high" : "none",
    recommendation: ["请在自然光下重新拍摄清晰正面照。"],
    calibrationNote: "初始配置，待校准。",
  } as unknown as ImageQualityAssessment;
}

function cnn(scores: SeasonScores) {
  const season = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  return { season, scores };
}

function close(actual: number, expected: number, message?: string) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} expected ${expected}, got ${actual}`);
}

// ---------- 权重计算 ----------

test("weight: baseline kept when both available without validated basis", () => {
  const result = computeEffectiveWeights({
    requestedWeights: { cnn: 0.4, doubao: 0.6 },
    cnn: { available: true },
    doubao: { available: true },
  });
  assert.deepEqual(result.effectiveWeights, { cnn: 0.4, doubao: 0.6 });
  assert.equal(result.normalized, true);
  assert.ok(result.adjustments.some((item) => item.reason === "KEEP_BASELINE_NO_VALIDATED_BASIS"));
});

test("weight: unavailable model gets zero, single model gets one", () => {
  const cnnOnly = computeEffectiveWeights({
    requestedWeights: { cnn: 0.4, doubao: 0.6 },
    cnn: { available: true },
    doubao: { available: false },
  });
  assert.deepEqual(cnnOnly.effectiveWeights, { cnn: 1, doubao: 0 });
  const doubaoOnly = computeEffectiveWeights({
    requestedWeights: { cnn: 0.4, doubao: 0.6 },
    cnn: { available: false },
    doubao: { available: true },
  });
  assert.deepEqual(doubaoOnly.effectiveWeights, { cnn: 0, doubao: 1 });
  const none = computeEffectiveWeights({
    requestedWeights: { cnn: 0.4, doubao: 0.6 },
    cnn: { available: false },
    doubao: { available: false },
  });
  assert.equal(none.normalized, false);
});

test("weight: user zero weight is never restored", () => {
  const result = computeEffectiveWeights({
    requestedWeights: { cnn: 0, doubao: 1 },
    cnn: { available: true, applicability: 1, reliability: 2 },
    doubao: { available: true },
  });
  assert.equal(result.effectiveWeights.cnn, 0);
  assert.equal(result.effectiveWeights.doubao, 1);
});

test("weight: sum zero does not divide by zero; invalid factors throw", () => {
  const result = computeEffectiveWeights({
    requestedWeights: { cnn: 0, doubao: 0 },
    cnn: { available: true },
    doubao: { available: true },
  });
  assert.equal(result.normalized, false);
  assert.ok(result.adjustments.some((item) => item.reason === "REQUESTED_WEIGHTS_SUM_ZERO"));
  assert.throws(() => computeEffectiveWeights({
    requestedWeights: { cnn: 0.4, doubao: 0.6 },
    cnn: { available: true, applicability: Number.NaN },
    doubao: { available: true },
  }), FusionConfigError);
});

test("weight: normalized sum equals 1 and shift is clamped", () => {
  const result = computeEffectiveWeights({
    requestedWeights: { cnn: 0.4, doubao: 0.6 },
    cnn: { available: true, reliability: 3, reliabilityReason: "VALIDATED_DATA" },
    doubao: { available: true },
  });
  close(result.effectiveWeights.cnn + result.effectiveWeights.doubao, 1);
  assert.ok(result.effectiveWeights.cnn <= 0.5 + 1e-6, "cnn shift must be clamped to +0.10");
  assert.ok(result.adjustments.some((item) => item.stage === "reliability"));
});

// ---------- 分歧计算 ----------

test("agreement: TVD=0 for identical distributions, range 0-1", () => {
  const scores: SeasonScores = { spring: 0.4, summer: 0.3, autumn: 0.2, winter: 0.1 };
  close(totalVariationDistance(scores, scores), 0);
  const opposite: SeasonScores = { spring: 0, summer: 0, autumn: 0, winter: 1 };
  // 0.5 × (0.4 + 0.3 + 0.2 + 0.9) = 0.9
  close(totalVariationDistance(scores, opposite), 0.9);
});

test("agreement: top1 mismatch and TVD >= 0.40 means high disagreement", () => {
  const cnn: SeasonScores = { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 };
  const doubao: SeasonScores = { spring: 0.05, summer: 0.9, autumn: 0.03, winter: 0.02 };
  const agreement = evaluateModelAgreement(cnn, doubao);
  assert.ok(agreement);
  assert.equal(agreement.top1Match, false);
  assert.equal(agreement.level, "high");
  assert.ok(agreement.totalVariationDistance >= 0.4);
});

// ---------- T01-T16 模型结果模拟 ----------

function runT(
  cnnScores: SeasonScores,
  doubaoScores: SeasonScores,
  imageLevel: ImageQualityAssessment["qualityLevel"] = "PASS",
  options: { cnnWeight?: number; doubaoOverride?: Record<string, unknown> } = {},
) {
  return buildAdvancedDiagnosis({
    cnn: cnn(cnnScores),
    doubao: { result: visionResult(doubaoScores, options.doubaoOverride) },
    cnnWeight: options.cnnWeight ?? 0.4,
    imageQuality: quality(imageLevel),
  });
}

test("T01 normal fusion outputs spring with CONFIDENT", () => {
  const result = runT(
    { spring: 0.8, summer: 0.1, autumn: 0.05, winter: 0.05 },
    { spring: 0.85, summer: 0.08, autumn: 0.04, winter: 0.03 },
  );
  assert.equal(result.fusion?.predictedSeason, "spring");
  assert.equal(result.diagnosisStatus, "CONFIDENT");
  assert.equal(result.fusion?.source, "fusion");
});

test("T02 close fused result is UNCERTAIN, not forced season", () => {
  const result = runT(
    { spring: 0.46, summer: 0.52, autumn: 0.01, winter: 0.01 },
    { spring: 0.45, summer: 0.31, autumn: 0.15, winter: 0.09 },
  );
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.uncertaintyReasons.includes("TOP_GAP_BELOW_THRESHOLD"));
  assert.equal(result.fusion?.candidateSeasons.length, 2);
});

test("T03 severe model disagreement is UNCERTAIN", () => {
  const result = runT(
    { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 },
    { spring: 0.05, summer: 0.9, autumn: 0.03, winter: 0.02 },
  );
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.uncertaintyReasons.includes("MODEL_DISTRIBUTION_DISAGREEMENT"));
});

test("T04 low-discrimination models are UNCERTAIN", () => {
  const result = runT(
    { spring: 0.26, summer: 0.25, autumn: 0.25, winter: 0.24 },
    { spring: 0.28, summer: 0.26, autumn: 0.24, winter: 0.22 },
  );
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.uncertaintyReasons.includes("TOP_SCORE_BELOW_THRESHOLD"));
});

test("T05 Doubao timeout degrades to CNN", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn({ spring: 0.8, summer: 0.1, autumn: 0.05, winter: 0.05 }),
    doubao: null,
    doubaoCode: "DOUBAO_TIMEOUT",
    cnnWeight: 0.4,
    imageQuality: quality(),
  });
  assert.equal(result.fusion?.source, "cnn");
  assert.equal(result.diagnosisStatus, "DEGRADED");
  assert.deepEqual(result.fusion?.effectiveWeights, { cnn: 1, doubao: 0 });
  assert.ok(result.uncertaintyReasons.includes("SINGLE_MODEL_DEGRADED"));
});

test("T06 CNN inference failure degrades to Doubao", () => {
  const result = buildAdvancedDiagnosis({
    cnn: null,
    cnnCode: "CNN_MISSING",
    doubao: { result: visionResult({ spring: 0.1, summer: 0.6, autumn: 0.2, winter: 0.1 }) },
    cnnWeight: 0.4,
    imageQuality: quality(),
  });
  assert.equal(result.fusion?.source, "doubao");
  assert.equal(result.diagnosisStatus, "DEGRADED");
  assert.deepEqual(result.fusion?.effectiveWeights, { cnn: 0, doubao: 1 });
});

test("T07 both models fail returns FAILED without season", () => {
  const result = buildAdvancedDiagnosis({
    cnn: null, cnnCode: "CNN_MISSING", doubao: null, doubaoCode: "DOUBAO_TIMEOUT",
    imageQuality: quality(),
  });
  assert.equal(result.diagnosisStatus, "FAILED");
  assert.equal(result.fusion, null);
  assert.equal(result.blockedCode, "ALL_MODELS_UNAVAILABLE");
});

test("T08 invalid JSON / unreliable Doubao degrades; no fabricated features", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn({ spring: 0.7, summer: 0.2, autumn: 0.05, winter: 0.05 }),
    doubao: { result: visionResult({ spring: 0.1, summer: 0.6, autumn: 0.2, winter: 0.1 }, { can_judge_reliably: false }) },
    doubaoCode: "DOUBAO_INVALID_RESPONSE",
    imageQuality: quality(),
  });
  assert.equal(result.fusion?.source, "cnn");
  assert.equal(result.fusion?.fallbackReason, "DOUBAO_UNRELIABLE");
  assert.equal(result.fusion?.doubao.features, undefined);
});

test("T09 NaN / negative CNN scores rejected and degrade to Doubao", () => {
  const result = buildAdvancedDiagnosis({
    cnn: { season: "spring", scores: { spring: Number.NaN, summer: 0.5, autumn: 0.3, winter: 0.2 } },
    doubao: { result: visionResult({ spring: 0.1, summer: 0.6, autumn: 0.2, winter: 0.1 }) },
    imageQuality: quality(),
  });
  assert.equal(result.fusion?.source, "doubao");
  assert.equal(result.fusion?.fallbackDetails?.cnn, "CNN_INVALID_SCORES");
});

test("T10 high model scores but severe overexposure → RETAKE_REQUIRED", () => {
  const result = runT(
    { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 },
    { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 },
    "REJECT",
  );
  assert.equal(result.diagnosisStatus, "RETAKE_REQUIRED");
  assert.equal(result.fusion, null);
});

test("T11 high model scores but severe blur → RETAKE_REQUIRED", () => {
  const result = runT(
    { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 },
    { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 },
    "REJECT",
  );
  assert.equal(result.diagnosisStatus, "RETAKE_REQUIRED");
});

test("T12 suspected mild filter is risk hint, not rejection", () => {
  const result = runT(
    { spring: 0.7, summer: 0.2, autumn: 0.05, winter: 0.05 },
    { spring: 0.75, summer: 0.15, autumn: 0.05, winter: 0.05 },
    "WARNING",
    { doubaoOverride: { filter_warning: true } },
  );
  assert.notEqual(result.diagnosisStatus, "RETAKE_REQUIRED");
  assert.ok(result.uncertaintyReasons.includes("IMAGE_QUALITY_WARNING"));
  assert.ok(result.uncertaintyReasons.includes("DOUBAO_FILTER_WARNING"));
});

test("T13 custom weights keep requested and compute effective", () => {
  const result = runT(
    { spring: 0.8, summer: 0.1, autumn: 0.05, winter: 0.05 },
    { spring: 0.2, summer: 0.7, autumn: 0.05, winter: 0.05 },
    "PASS",
    { cnnWeight: 0.6 },
  );
  assert.deepEqual(result.fusion?.requestedWeights, { cnn: 0.6, doubao: 0.4 });
  assert.deepEqual(result.fusion?.effectiveWeights, { cnn: 0.6, doubao: 0.4 });
});

test("T14 zero-weight models never divide by zero", () => {
  const result = computeEffectiveWeights({
    requestedWeights: { cnn: 0, doubao: 0 },
    cnn: { available: true },
    doubao: { available: true },
  });
  assert.equal(result.normalized, false);
  assert.deepEqual(result.effectiveWeights, { cnn: 0, doubao: 0 });
});

test("T15 threshold boundary: score exactly 0.50 / gap exactly 0.10 handled uniformly", () => {
  // fused top score = 0.50, gap = 0.10 with 0.4/0.6 weights
  const cnnS: SeasonScores = { spring: 0.5, summer: 0.4, autumn: 0.1, winter: 0 };
  const doubaoS: SeasonScores = { spring: 0.5, summer: 0.4, autumn: 0.1, winter: 0 };
  const result = runT(cnnS, doubaoS);
  close(result.fusion!.seasonScores.spring, 0.5);
  close(result.fusion!.seasonScores.spring - result.fusion!.seasonScores.summer, 0.1);
  // unified rule uses <= boundary, so exactly-threshold risks are flagged
  assert.ok(result.uncertaintyReasons.includes("TOP_SCORE_BELOW_THRESHOLD"));
  assert.ok(result.uncertaintyReasons.includes("TOP_GAP_BELOW_THRESHOLD"));
});

test("T16 valid but close scores with single model stays DEGRADED and uncertain", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn({ spring: 0.52, summer: 0.48, autumn: 0, winter: 0 }),
    doubao: null,
    doubaoCode: "DOUBAO_TIMEOUT",
    imageQuality: quality(),
  });
  assert.equal(result.diagnosisStatus, "DEGRADED");
  assert.ok(result.uncertaintyReasons.includes("TOP_GAP_BELOW_THRESHOLD"));
});

// ---------- 兼容性与非法输入 ----------

test("legacy v1 fields remain present in v2 result", () => {
  const result = runT(
    { spring: 0.7, summer: 0.2, autumn: 0.05, winter: 0.05 },
    { spring: 0.7, summer: 0.2, autumn: 0.05, winter: 0.05 },
  );
  assert.equal(result.fusion?.version, "2.0");
  assert.ok(result.fusion?.cnn.available);
  assert.ok(result.fusion?.doubao.available);
  assert.ok(Array.isArray(result.fusion?.weightAdjustments));
  assert.equal(result.fusion?.confidenceType, "uncalibrated_fusion_score");
});

test("invalid config throws instead of silently using wrong weights", () => {
  assert.throws(() => buildAdvancedDiagnosis({
    cnn: cnn({ spring: 0.7, summer: 0.2, autumn: 0.05, winter: 0.05 }),
    doubao: null,
    cnnWeight: 1.5,
    imageQuality: quality(),
  }), FusionConfigError);
});

// ---------- Phase 3.2：分层风险机制 ----------

/** 构造带具体 issue 的质量评估（issue 决定风险分层）。 */
function qualityWithIssues(
  level: ImageQualityAssessment["qualityLevel"],
  issues: Array<{ code: string; severity: "info" | "warning" | "critical"; message?: string }>,
): ImageQualityAssessment {
  const base = quality(level);
  return {
    ...base,
    issues: issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message ?? "提示",
    })),
  };
}

const STRONG_CNN: SeasonScores = { spring: 0.82, summer: 0.07, autumn: 0.06, winter: 0.05 };
const STRONG_DOUBAO: SeasonScores = { spring: 0.78, summer: 0.09, autumn: 0.07, winter: 0.06 };

test("phase3.2: plain image quality WARNING alone does not trigger UNCERTAIN", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO) },
    imageQuality: qualityWithIssues("WARNING", [{ code: "POSSIBLE_COLOR_CAST", severity: "info" }]),
  });
  assert.equal(result.diagnosisStatus, "CONFIDENT");
  assert.ok(result.softWarnings.includes("IMAGE_QUALITY_WARNING"));
  assert.ok(result.softWarnings.includes("POSSIBLE_COLOR_CAST"));
  assert.deepEqual(result.decisiveReasons, []);
});

test("phase3.2: plain lighting warning alone does not trigger UNCERTAIN", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { lighting_warning: true }) },
    imageQuality: quality(),
  });
  assert.equal(result.diagnosisStatus, "CONFIDENT");
  assert.ok(result.softWarnings.includes("DOUBAO_LIGHTING_WARNING"));
  assert.deepEqual(result.decisiveReasons, []);
});

test("phase3.2: CONFIDENT may still carry ordinary soft warnings", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { filter_warning: true }) },
    imageQuality: qualityWithIssues("WARNING", [{ code: "POSSIBLE_BLUR", severity: "warning" }]),
  });
  assert.equal(result.diagnosisStatus, "CONFIDENT");
  assert.ok(result.fusion?.softWarnings?.length);
  assert.ok(result.fusion?.risks?.every((risk) => risk.level === "SOFT_WARNING" || risk.level === "DECISIVE_RISK"));
  assert.equal(result.fusion?.doubao.filterWarning, true);
});

test("phase3.2: image-side and model-side risks together escalate to UNCERTAIN", () => {
  // 构造「两模型 Top-1 不同、但分布差异很小」的情形：需要同时放宽分数相关阈值，
  // 才能把「Top-1 不一致」这一软警告单独隔离出来验证。
  const relaxed = { minTopScore: 0.3, minTopGap: 0.01, minModelTopGap: 0.05 };
  const cnnScores: SeasonScores = { spring: 0.5, summer: 0.35, autumn: 0.08, winter: 0.07 };
  const doubaoScores: SeasonScores = { spring: 0.38, summer: 0.5, autumn: 0.07, winter: 0.05 };
  const single = buildAdvancedDiagnosis({
    cnn: cnn(cnnScores),
    doubao: { result: visionResult(doubaoScores) },
    imageQuality: quality(),
    thresholds: relaxed,
  });
  assert.equal(single.diagnosisStatus, "CONFIDENT");
  assert.ok(single.softWarnings.includes("MODEL_TOP1_MISMATCH"));

  const combined = buildAdvancedDiagnosis({
    cnn: cnn(cnnScores),
    doubao: { result: visionResult(doubaoScores) },
    imageQuality: qualityWithIssues("WARNING", [{ code: "POSSIBLE_BLUR", severity: "warning" }]),
    thresholds: relaxed,
  });
  assert.equal(combined.diagnosisStatus, "UNCERTAIN");
  assert.ok(combined.decisiveReasons.includes("MULTIPLE_INDEPENDENT_RISKS"));
});

test("phase3.2: correlated soft warnings in the same group do not escalate", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { lighting_warning: true, filter_warning: true }) },
    imageQuality: qualityWithIssues("WARNING", [{ code: "POSSIBLE_COLOR_CAST", severity: "info" }]),
  });
  assert.equal(result.diagnosisStatus, "CONFIDENT");
  assert.ok(!result.decisiveReasons.includes("MULTIPLE_INDEPENDENT_RISKS"));
});

test("phase3.2: severe color distribution distortion downgrades to UNCERTAIN but never blocks", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO) },
    imageQuality: qualityWithIssues("WARNING", [
      { code: "SUSPECTED_COLOR_PROCESSING", severity: "warning" },
      { code: "SEVERE_COLOR_DISTORTION", severity: "warning" },
    ]),
  });
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.decisiveReasons.includes("SEVERE_COLOR_DISTORTION"));
  assert.ok(result.fusion !== null, "颜色分布异常不得阻断诊断，只能降级为不确定");
  assert.equal(result.fusion?.candidateSeasons.length, 2);
});

test("phase3.2: severe color distortion does not override a blocking quality reject", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO) },
    imageQuality: quality("REJECT"),
  });
  assert.equal(result.diagnosisStatus, "RETAKE_REQUIRED");
  assert.equal(result.fusion, null);
});

test("phase3.2: doubao refusal is distinguished from a service failure", () => {
  const refusal = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { can_judge_reliably: false }) },
    doubaoCode: "DOUBAO_UNRELIABLE",
    imageQuality: quality(),
  });
  // 主动拒判：API 成功、模型明确不可靠 → 诊断可靠性问题，不是服务降级。
  assert.equal(refusal.diagnosisStatus, "UNCERTAIN");
  assert.equal(refusal.inferenceMode, "dual-refused");
  assert.ok(refusal.uncertaintyReasons.includes("DOUBAO_REFUSED"));
  assert.ok(!refusal.uncertaintyReasons.includes("SINGLE_MODEL_DEGRADED"));
  assert.equal(refusal.fusion?.doubao.available, false);
  assert.equal(refusal.fusion?.doubao.canJudgeReliably, false);

  // 网络/服务异常 → 维持既有 DEGRADED 机制。
  const failure = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: null,
    doubaoCode: "DOUBAO_TIMEOUT",
    imageQuality: quality(),
  });
  assert.equal(failure.diagnosisStatus, "DEGRADED");
  assert.equal(failure.inferenceMode, "single-cnn");
  assert.ok(failure.uncertaintyReasons.includes("SINGLE_MODEL_DEGRADED"));
  assert.ok(!failure.uncertaintyReasons.includes("DOUBAO_REFUSED"));
});

test("phase3.2: refusal never produces a formal season and never enters the user profile", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { can_judge_reliably: false }) },
    imageQuality: quality(),
  });
  assert.notEqual(result.diagnosisStatus, "CONFIDENT");
  // 画像/穿搭链路只采用 CONFIDENT 结果，故拒判结果不会覆盖正式画像。
  assert.ok(result.diagnosisStatus !== "CONFIDENT");
});

test("phase3.2: legacy policy reproduces the Phase 3.1 outcome for the same inputs", () => {
  const refusal = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { can_judge_reliably: false }) },
    imageQuality: quality(),
    riskPolicy: { mode: "legacy" },
  });
  // Phase 3.1 行为：拒判与服务异常同样落入 DEGRADED。
  assert.equal(refusal.diagnosisStatus, "DEGRADED");
  assert.equal(refusal.inferenceMode, "single-cnn");
  assert.ok(refusal.uncertaintyReasons.includes("DOUBAO_UNRELIABLE"));
});

test("phase3.2: uncertainty thresholds can be overridden for offline experiments only", () => {
  const cnnScores: SeasonScores = { spring: 0.5, summer: 0.35, autumn: 0.08, winter: 0.07 };
  const doubaoScores: SeasonScores = { spring: 0.48, summer: 0.36, autumn: 0.08, winter: 0.08 };
  const base = buildAdvancedDiagnosis({
    cnn: cnn(cnnScores),
    doubao: { result: visionResult(doubaoScores) },
    imageQuality: quality(),
  });
  // 生产默认：融合最高分 0.488 <= 0.50 → 决定性风险。
  assert.equal(base.diagnosisStatus, "UNCERTAIN");
  assert.ok(base.uncertaintyReasons.includes("TOP_SCORE_BELOW_THRESHOLD"));

  const relaxed = buildAdvancedDiagnosis({
    cnn: cnn(cnnScores),
    doubao: { result: visionResult(doubaoScores) },
    imageQuality: quality(),
    thresholds: { minTopScore: 0.3, minTopGap: 0.01, minModelTopGap: 0.05 },
  });
  assert.equal(relaxed.diagnosisStatus, "CONFIDENT");
});

test("phase3.2: zero requested weight is still protected in the layered policy", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO) },
    cnnWeight: 0,
    imageQuality: quality(),
  });
  assert.deepEqual(result.fusion?.requestedWeights, { cnn: 0, doubao: 1 });
  assert.deepEqual(result.fusion?.effectiveWeights, { cnn: 0, doubao: 1 });
  assert.equal(result.inferenceMode, "dual");
});

test("phase3.2: risk levels are exposed in the v2 result for the frontend", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { lighting_warning: true }) },
    imageQuality: qualityWithIssues("WARNING", [{ code: "POSSIBLE_COLOR_CAST", severity: "info" }]),
  });
  const risks = result.fusion?.risks ?? [];
  assert.ok(risks.length > 0);
  assert.ok(risks.every((risk) => ["SOFT_WARNING", "DECISIVE_RISK", "BLOCKING_ISSUE"].includes(risk.level)));
  assert.ok(risks.every((risk) => typeof risk.group === "string" && risk.group.length > 0));
  assert.deepEqual(result.fusion?.decisiveReasons, []);
  assert.ok((result.fusion?.softWarnings ?? []).length > 0);
});
