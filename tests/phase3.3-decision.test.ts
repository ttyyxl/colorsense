import test from "node:test";
import assert from "node:assert/strict";
import { VisionResultSchema, type SeasonScores, type VisionResult } from "../src/lib/vision-schema.ts";
import type { ImageQualityAssessment } from "../src/lib/diagnosis-types.ts";
import { buildAdvancedDiagnosis } from "../src/lib/advanced-diagnosis.ts";
import { assembleAdvancedDiagnosisFields } from "../src/lib/fusion-api.ts";
import {
  decideDiagnosisStatus,
  isBlockingDiagnosisStatus,
  isExecutableDiagnosisStatus,
  resolveDiagnosisStatusOf,
} from "../src/lib/diagnosis-status.ts";
import { presentationForStatus } from "../src/lib/diagnosis-status-ui.ts";
import { DEFAULT_CNN_WEIGHT } from "../src/lib/fusion.ts";

/**
 * Phase 3.3「季型诊断决策机制优化」回归测试。
 *
 * 核心业务规则：
 * 1. 取消「最高融合评分必须达到 50% 才能确认季型」的限制；
 * 2. 分数不足 / 分差过小 / 模型分歧只作为不确定性提示，不阻止返回季型；
 * 3. 豆包拒判、超时、返回无效评分时，CNN 结果有效即采用 CNN 结果；
 * 4. UNCERTAIN / DEGRADED 允许正常展示季型、色板、画像并生成穿搭建议；
 * 5. 严重图像质量异常与两模型均不可用仍然硬阻断，禁止生成虚假诊断结果；
 * 6. 顶层 seasonType / confidence / scores 与 fusionDiagnosis 严格同源，评分不被抬高。
 */

/* ------------------------------------------------------------------ */
/* 夹具                                                                */
/* ------------------------------------------------------------------ */

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

/** 两模型一致但分数整体偏低（最高分远低于 50%）。 */
const LOW_BOTH: SeasonScores = { spring: 0.3, summer: 0.28, autumn: 0.22, winter: 0.2 };
/** 两模型一致且区分度清晰。 */
const STRONG_CNN: SeasonScores = { spring: 0.82, summer: 0.07, autumn: 0.06, winter: 0.05 };
const STRONG_DOUBAO: SeasonScores = { spring: 0.78, summer: 0.09, autumn: 0.07, winter: 0.06 };

/* ------------------------------------------------------------------ */
/* 1. 最高融合评分不足 50%                                            */
/* ------------------------------------------------------------------ */

test("phase3.3: 最高融合评分不足 50% 时仍按 argmax 返回季型，并记录不确定性提示", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(LOW_BOTH),
    doubao: { result: visionResult(LOW_BOTH) },
    imageQuality: quality(),
  });

  // 有效季型结果照常产出。
  assert.ok(result.fusion !== null, "分数不足不得阻断季型输出");
  assert.equal(result.hasValidSeasonResult, true);
  assert.equal(result.fusion?.predictedSeason, "spring");

  // 但可靠性状态如实标记为不确定。
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.uncertaintyReasons.includes("TOP_SCORE_BELOW_THRESHOLD"));
  assert.ok(result.decisiveReasons.includes("TOP_SCORE_BELOW_THRESHOLD"));

  // 分数未被抬高：融合最高分确实低于 50%。
  const top = result.fusion!.seasonScores.spring;
  assert.ok(top < 0.5, `expected top score below 0.5, got ${top}`);
});

test("phase3.3: 分数不足 50% 仍可通过适配层拿到完整业务字段", () => {
  const fields = assembleAdvancedDiagnosisFields({
    fusionEnabled: true,
    cnnWeight: DEFAULT_CNN_WEIGHT,
    cnn: cnn(LOW_BOTH),
    cnnCode: "OK",
    doubao: { result: visionResult(LOW_BOTH) },
    doubaoCode: "OK",
    imageQuality: quality(),
    legacy: { seasonType: "spring", confidence: 0.3 },
  });

  assert.equal(fields.blocked, false);
  assert.equal(fields.hasValidSeasonResult, true);
  assert.equal(fields.diagnosisStatus, "UNCERTAIN");
  assert.equal(fields.seasonType, "spring");
  assert.ok(typeof fields.confidence === "number");
  assert.ok(fields.scores);
});

/* ------------------------------------------------------------------ */
/* 2. 模型分歧                                                        */
/* ------------------------------------------------------------------ */

test("phase3.3: 两模型分歧时仍返回融合后的季型，并提示分歧风险", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn({ spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 }),
    doubao: { result: visionResult({ spring: 0.05, summer: 0.9, autumn: 0.03, winter: 0.02 }) },
    imageQuality: quality(),
  });

  assert.ok(result.fusion !== null);
  assert.equal(result.hasValidSeasonResult, true);
  // argmax 严格取最终融合分数最高的季型（0.4 CNN / 0.6 豆包下为 summer）。
  assert.equal(result.fusion?.predictedSeason, "summer");
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.uncertaintyReasons.includes("MODEL_DISTRIBUTION_DISAGREEMENT"));
  assert.ok(result.uncertaintyReasons.includes("MODEL_TOP1_MISMATCH"));
});

/* ------------------------------------------------------------------ */
/* 3. 豆包主动拒判                                                    */
/* ------------------------------------------------------------------ */

test("phase3.3: 豆包主动拒判时自动采用 CNN 结果，豆包不得单方面否决有效判断", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: { result: visionResult(STRONG_DOUBAO, { can_judge_reliably: false }) },
    doubaoCode: "DOUBAO_UNRELIABLE",
    imageQuality: quality(),
  });

  assert.ok(result.fusion !== null, "CNN 有效时不得因豆包拒判而没有季型");
  assert.equal(result.hasValidSeasonResult, true);
  assert.equal(result.fusion?.source, "cnn");
  assert.equal(result.fusion?.predictedSeason, "spring");
  assert.equal(result.fusion?.fallbackReason, "DOUBAO_UNRELIABLE");
  assert.equal(result.fusion?.doubao.available, false);
  assert.equal(result.fusion?.doubao.features, undefined, "拒判结果不得产出色彩特征");
  // 状态仍如实标记不确定，但不再阻断业务。
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.equal(result.inferenceMode, "dual-refused");
  assert.ok(result.uncertaintyReasons.includes("DOUBAO_REFUSED"));
});

/* ------------------------------------------------------------------ */
/* 4. 豆包 API 超时                                                   */
/* ------------------------------------------------------------------ */

test("phase3.3: 豆包 API 超时时降级为单模型 CNN 结果并保留季型", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn(STRONG_CNN),
    doubao: null,
    doubaoCode: "DOUBAO_TIMEOUT",
    imageQuality: quality(),
  });

  assert.ok(result.fusion !== null);
  assert.equal(result.hasValidSeasonResult, true);
  assert.equal(result.fusion?.source, "cnn");
  assert.equal(result.fusion?.predictedSeason, "spring");
  assert.equal(result.fusion?.fallbackReason, "DOUBAO_TIMEOUT");
  assert.equal(result.diagnosisStatus, "DEGRADED");
  assert.equal(result.inferenceMode, "single-cnn");
  assert.ok(result.uncertaintyReasons.includes("SINGLE_MODEL_DEGRADED"));
});

/* ------------------------------------------------------------------ */
/* 5. 单模型降级                                                      */
/* ------------------------------------------------------------------ */

test("phase3.3: 单模型降级（仅豆包可用）同样产出有效季型结果", () => {
  const result = buildAdvancedDiagnosis({
    cnn: null,
    cnnCode: "CNN_MISSING",
    doubao: { result: visionResult(STRONG_DOUBAO) },
    imageQuality: quality(),
  });

  assert.ok(result.fusion !== null);
  assert.equal(result.hasValidSeasonResult, true);
  assert.equal(result.fusion?.source, "doubao");
  assert.equal(result.fusion?.predictedSeason, "spring");
  assert.equal(result.diagnosisStatus, "DEGRADED");
  assert.equal(result.inferenceMode, "single-doubao");
});

test("phase3.3: DEGRADED 状态在适配层仍是可执行结果（不被阻断）", () => {
  const fields = assembleAdvancedDiagnosisFields({
    fusionEnabled: true,
    cnnWeight: DEFAULT_CNN_WEIGHT,
    cnn: null,
    cnnCode: "CNN_MISSING",
    doubao: { result: visionResult(STRONG_DOUBAO) },
    doubaoCode: "OK",
    imageQuality: quality(),
    legacy: { seasonType: "spring", confidence: 0.78 },
  });

  assert.equal(fields.blocked, false);
  assert.equal(fields.hasValidSeasonResult, true);
  assert.equal(fields.diagnosisStatus, "DEGRADED");
  assert.equal(fields.seasonType, "spring");
  assert.ok(fields.scores);
});

/* ------------------------------------------------------------------ */
/* 6. 极低区分度                                                      */
/* ------------------------------------------------------------------ */

test("phase3.3: 两模型区分度极低时仍按 argmax 返回季型，并提示区分度不足", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn({ spring: 0.26, summer: 0.25, autumn: 0.25, winter: 0.24 }),
    doubao: { result: visionResult({ spring: 0.28, summer: 0.26, autumn: 0.24, winter: 0.22 }) },
    imageQuality: quality(),
  });

  assert.ok(result.fusion !== null);
  assert.equal(result.hasValidSeasonResult, true);
  assert.equal(result.fusion?.predictedSeason, "spring");
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.uncertaintyReasons.includes("TOP_SCORE_BELOW_THRESHOLD"));
  assert.ok(result.uncertaintyReasons.includes("CNN_LOW_DISCRIMINATION"));
  assert.ok(result.uncertaintyReasons.includes("DOUBAO_LOW_DISCRIMINATION"));
});

/* ------------------------------------------------------------------ */
/* 7. 严重图片质量异常（硬阻断）                                       */
/* ------------------------------------------------------------------ */

test("phase3.3: 严重图片质量异常仍然硬阻断，不产出任何季型结果", () => {
  const result = buildAdvancedDiagnosis({
    cnn: cnn({ spring: 0.95, summer: 0.02, autumn: 0.02, winter: 0.01 }),
    doubao: { result: visionResult({ spring: 0.95, summer: 0.02, autumn: 0.02, winter: 0.01 }) },
    imageQuality: quality("REJECT"),
  });

  assert.equal(result.diagnosisStatus, "RETAKE_REQUIRED");
  assert.equal(result.hasValidSeasonResult, false);
  assert.equal(result.fusion, null);
  assert.equal(result.blockedCode, "IMAGE_QUALITY_REJECT");
  assert.ok(result.uncertaintyReasons.includes("IMAGE_QUALITY_REJECT"));
});

test("phase3.3: 严重图片质量异常时适配层不产生 seasonType/confidence/scores", () => {
  const fields = assembleAdvancedDiagnosisFields({
    fusionEnabled: true,
    cnnWeight: DEFAULT_CNN_WEIGHT,
    cnn: cnn({ spring: 0.95, summer: 0.02, autumn: 0.02, winter: 0.01 }),
    cnnCode: "OK",
    doubao: { result: visionResult({ spring: 0.95, summer: 0.02, autumn: 0.02, winter: 0.01 }) },
    doubaoCode: "OK",
    imageQuality: quality("REJECT"),
    legacy: { seasonType: "spring", confidence: 0.95 },
  });

  assert.equal(fields.blocked, true);
  assert.equal(fields.hasValidSeasonResult, false);
  assert.equal(fields.diagnosisStatus, "RETAKE_REQUIRED");
  assert.equal("seasonType" in fields, false);
  assert.equal("confidence" in fields, false);
  assert.equal("scores" in fields, false);
});

/* ------------------------------------------------------------------ */
/* 8. 两模型均不可用（硬阻断）                                         */
/* ------------------------------------------------------------------ */

test("phase3.3: 两模型均不可用仍然硬阻断，禁止生成虚假诊断结果", () => {
  const result = buildAdvancedDiagnosis({
    cnn: null,
    cnnCode: "CNN_MISSING",
    doubao: null,
    doubaoCode: "DOUBAO_TIMEOUT",
    imageQuality: quality(),
  });

  assert.equal(result.diagnosisStatus, "FAILED");
  assert.equal(result.hasValidSeasonResult, false);
  assert.equal(result.fusion, null);
  assert.equal(result.blockedCode, "ALL_MODELS_UNAVAILABLE");
});

test("phase3.3: 豆包拒判且 CNN 也无有效评分时仍然失败，不伪造季型", () => {
  const result = buildAdvancedDiagnosis({
    cnn: { season: "spring", scores: { spring: Number.NaN, summer: 0.5, autumn: 0.3, winter: 0.2 } },
    cnnCode: "CNN_INVALID_SCORES",
    doubao: { result: visionResult(STRONG_DOUBAO, { can_judge_reliably: false }) },
    doubaoCode: "DOUBAO_UNRELIABLE",
    imageQuality: quality(),
  });

  assert.equal(result.diagnosisStatus, "FAILED");
  assert.equal(result.fusion, null);
  assert.equal(result.hasValidSeasonResult, false);
});

/* ------------------------------------------------------------------ */
/* 9. 顶层字段与 fusionDiagnosis 严格同源                             */
/* ------------------------------------------------------------------ */

test("phase3.3: 顶层 seasonType/confidence/scores 与 fusionDiagnosis 完全一致", () => {
  const cases: Array<{ cnn: SeasonScores; doubao: SeasonScores }> = [
    { cnn: STRONG_CNN, doubao: STRONG_DOUBAO },
    { cnn: LOW_BOTH, doubao: LOW_BOTH },
    { cnn: { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 }, doubao: { spring: 0.05, summer: 0.9, autumn: 0.03, winter: 0.02 } },
  ];

  for (const item of cases) {
    const fields = assembleAdvancedDiagnosisFields({
      fusionEnabled: true,
      cnnWeight: DEFAULT_CNN_WEIGHT,
      cnn: cnn(item.cnn),
      cnnCode: "OK",
      doubao: { result: visionResult(item.doubao) },
      doubaoCode: "OK",
      imageQuality: quality(),
      legacy: { seasonType: "spring", confidence: 0 },
    });

    const fusion = fields.fusionDiagnosis!;
    assert.equal(fields.seasonType, fusion.predictedSeason);
    assert.deepEqual(fields.scores, fusion.seasonScores);
    close(fields.confidence!, fusion.seasonScores[fusion.predictedSeason]);
    // confidence 恒等于 Top-1 分数本身，不得被抬高。
    close(fields.confidence!, fusion.seasonScores[fusion.predictedSeason], "confidence must equal top-1 score");
  }
});

test("phase3.3: 融合权重仍由环境变量机制决定，本轮不改动默认权重", () => {
  assert.equal(DEFAULT_CNN_WEIGHT, 0.4);
  const fields = assembleAdvancedDiagnosisFields({
    fusionEnabled: true,
    cnnWeight: 0.4,
    cnn: cnn(STRONG_CNN),
    cnnCode: "OK",
    doubao: { result: visionResult(STRONG_DOUBAO) },
    doubaoCode: "OK",
    imageQuality: quality(),
    legacy: { seasonType: "spring", confidence: 0 },
  });
  assert.deepEqual(fields.fusionDiagnosis?.requestedWeights, { cnn: 0.4, doubao: 0.6 });
  assert.deepEqual(fields.fusionDiagnosis?.effectiveWeights, { cnn: 0.4, doubao: 0.6 });
});

test("phase3.3: 单模型场景下的分数为模型原始评分的归一化值，不被改写", () => {
  // 推理服务返回的原始 softmax 数值（此处刻意不归一化）。
  const rawScores = { spring: 42, summer: 30, autumn: 15, winter: 13 };
  const result = buildAdvancedDiagnosis({
    cnn: { season: "spring", scores: rawScores },
    doubao: null,
    doubaoCode: "DOUBAO_TIMEOUT",
    imageQuality: quality(),
  });

  assert.ok(result.fusion !== null);
  // 原始数值原样保留在 cnn.seasonScores 中，供溯源使用。
  assert.deepEqual(result.fusion.cnn.seasonScores, rawScores);
  // 最终结果使用归一化后的分数，未做任何抬高。
  close(result.fusion.seasonScores.spring, 0.42);
  assert.equal(result.fusion.predictedSeason, "spring");
});

/* ------------------------------------------------------------------ */
/* 10. 状态与业务可执行性解耦                                          */
/* ------------------------------------------------------------------ */

test("phase3.3: 只有 RETAKE_REQUIRED / FAILED 是硬阻断状态", () => {
  assert.equal(isBlockingDiagnosisStatus("RETAKE_REQUIRED"), true);
  assert.equal(isBlockingDiagnosisStatus("FAILED"), true);
  assert.equal(isBlockingDiagnosisStatus("UNCERTAIN"), false);
  assert.equal(isBlockingDiagnosisStatus("DEGRADED"), false);
  assert.equal(isBlockingDiagnosisStatus("CONFIDENT"), false);
  // 旧记录没有状态字段时按可执行处理，保持向后兼容。
  assert.equal(isBlockingDiagnosisStatus(undefined), false);
});

test("phase3.3: UNCERTAIN / DEGRADED 允许执行业务（展示与生成后续建议）", () => {
  assert.equal(isExecutableDiagnosisStatus("UNCERTAIN"), true);
  assert.equal(isExecutableDiagnosisStatus("DEGRADED"), true);
  assert.equal(isExecutableDiagnosisStatus("CONFIDENT"), true);
  assert.equal(isExecutableDiagnosisStatus("RETAKE_REQUIRED"), false);
  assert.equal(isExecutableDiagnosisStatus("FAILED"), false);
});

test("phase3.3: 状态决策只影响可靠性标记，不再阻断业务", () => {
  const decision = decideDiagnosisStatus({
    imageQuality: quality(),
    cnnAvailable: true,
    doubaoAvailable: true,
    agreement: null,
    fusedScores: LOW_BOTH,
  });
  assert.equal(decision.status, "UNCERTAIN");
  assert.equal(decision.blocked, false);
  assert.ok(decision.uncertaintyReasons.includes("TOP_SCORE_BELOW_THRESHOLD"));
});

test("phase3.3: 前端展示层对 UNCERTAIN / DEGRADED 开放季型与下游入口", () => {
  for (const status of ["UNCERTAIN", "DEGRADED"] as const) {
    const presentation = presentationForStatus(status);
    assert.equal(presentation.showFormalSeason, true, `${status} 应展示季型`);
    assert.equal(presentation.showDownstreamActions, true, `${status} 应开放下游入口`);
    assert.equal(presentation.carriesUncertainty, true, `${status} 应提示不确定性`);
  }
  for (const status of ["RETAKE_REQUIRED", "FAILED"] as const) {
    const presentation = presentationForStatus(status);
    assert.equal(presentation.showFormalSeason, false, `${status} 不应展示季型`);
    assert.equal(presentation.showDownstreamActions, false, `${status} 不应开放下游入口`);
  }
});

/* ------------------------------------------------------------------ */
/* 11. 诊断记录状态解析                                                */
/* ------------------------------------------------------------------ */

test("phase3.3: 诊断记录状态解析优先取融合结果，其次顶层字段，缺省为 CONFIDENT", () => {
  assert.equal(
    resolveDiagnosisStatusOf({ fusionDiagnosis: { version: "2.0", diagnosisStatus: "DEGRADED" } }),
    "DEGRADED",
  );
  assert.equal(
    resolveDiagnosisStatusOf({
      diagnosisStatus: "UNCERTAIN",
      fusionDiagnosis: { version: "2.0", diagnosisStatus: "DEGRADED" },
    }),
    "DEGRADED",
  );
  assert.equal(resolveDiagnosisStatusOf({ diagnosisStatus: "UNCERTAIN" }), "UNCERTAIN");
  assert.equal(resolveDiagnosisStatusOf({}), "CONFIDENT");
});
