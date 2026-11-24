import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CNN_WEIGHT,
  FusionConfigError,
  FusionUnavailableError,
  buildFusionDiagnosis,
  classifyVisionFailure,
  fuseSeasonScores,
  normalizeSeasonScores,
  readFusionConfig,
  validateSeasonScores,
  type SeasonScores,
} from "../src/lib/fusion.ts";
import { VisionResultSchema, type VisionResult } from "../src/lib/vision-schema.ts";

function makeVisionResult(overrides: Record<string, unknown> = {}): VisionResult {
  const parsed = VisionResultSchema.parse({
    season_scores: { spring: 0.1, summer: 0.6, autumn: 0.2, winter: 0.1 },
    most_likely_season: "summer",
    skin_undertone: "cool",
    brightness: "light",
    saturation: "soft",
    feature_contrast: "low",
    lighting_warning: false,
    filter_warning: false,
    can_judge_reliably: true,
    reason: "观察到肤色偏冷、对比柔和，据此推断为夏季型。",
    ...overrides,
  });
  return parsed;
}

function close(actual: number, expected: number, message?: string) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} expected ${expected}, got ${actual}`);
}

const cnnScores: SeasonScores = { spring: 0.7, summer: 0.2, autumn: 0.05, winter: 0.05 };
const doubaoScores: SeasonScores = { spring: 0.1, summer: 0.6, autumn: 0.2, winter: 0.1 };

test("40:60 fusion calculates each season and picks argmax", () => {
  const fused = fuseSeasonScores(cnnScores, doubaoScores);
  close(fused.seasonScores.spring, 0.34, "spring");
  close(fused.seasonScores.summer, 0.44, "summer");
  close(fused.seasonScores.autumn, 0.14, "autumn");
  close(fused.seasonScores.winter, 0.08, "winter");
  assert.equal(fused.predictedSeason, "summer");
  close(Object.values(fused.seasonScores).reduce((a, b) => a + b, 0), 1);
});

test("0:100 and 100:0 boundary weights return the single model scores", () => {
  const doubaoOnly = fuseSeasonScores(cnnScores, doubaoScores, 0);
  assert.deepEqual(doubaoOnly.seasonScores, doubaoScores);
  assert.equal(doubaoOnly.predictedSeason, "summer");

  const cnnOnly = fuseSeasonScores(cnnScores, doubaoScores, 1);
  assert.deepEqual(cnnOnly.seasonScores, cnnScores);
  assert.equal(cnnOnly.predictedSeason, "spring");
});

test("scores are normalized before weighting and final scores sum to 1", () => {
  const unnormalized: SeasonScores = { spring: 2, summer: 1, autumn: 1, winter: 0 };
  const fused = fuseSeasonScores(unnormalized, doubaoScores, 1);
  assert.deepEqual(fused.seasonScores, { spring: 0.5, summer: 0.25, autumn: 0.25, winter: 0 });
  close(Object.values(normalizeSeasonScores(unnormalized)!).reduce((a, b) => a + b, 0), 1);
});

test("invalid scores are rejected instead of being fabricated", () => {
  const invalid = [
    { spring: 0.2, summer: 0.5, autumn: 0.3 },           // missing winter
    { spring: -0.1, summer: 0.5, autumn: 0.3, winter: 0.3 },
    { spring: Number.NaN, summer: 0.5, autumn: 0.3, winter: 0.2 },
    { spring: Number.POSITIVE_INFINITY, summer: 0.1, autumn: 0.1, winter: 0.1 },
    { spring: 0, summer: 0, autumn: 0, winter: 0 },       // non-positive sum
  ];
  for (const scores of invalid) {
    assert.equal(validateSeasonScores(scores), null);
    assert.equal(normalizeSeasonScores(scores), null);
    assert.throws(() => fuseSeasonScores(scores as SeasonScores, doubaoScores), FusionUnavailableError);
  }
});

test("tied top scores resolve deterministically by SEASON_KEYS order", () => {
  const tied: SeasonScores = { spring: 0.25, summer: 0.25, autumn: 0.25, winter: 0.25 };
  assert.equal(fuseSeasonScores(tied, tied).predictedSeason, "spring");
  assert.equal(fuseSeasonScores(doubaoScores, tied, 0).predictedSeason, "spring");
});

test("Doubao API failure falls back to pure CNN with machine-readable reason", () => {
  const result = buildFusionDiagnosis({
    cnn: { season: "spring", scores: cnnScores },
    cnnCode: "OK",
    doubao: null,
    doubaoCode: "DOUBAO_TIMEOUT",
  });
  assert.equal(result.source, "cnn");
  assert.deepEqual(result.effectiveWeights, { cnn: 1, doubao: 0 });
  assert.equal(result.fallbackReason, "DOUBAO_TIMEOUT");
  assert.deepEqual(result.predictedSeason, "spring");
  assert.deepEqual(result.cnn.seasonScores, cnnScores); // 原始 softmax 不被覆盖
  assert.equal(result.doubao.available, false);
});

test("Doubao rejection falls back to CNN and hides unreliable features", () => {
  const result = buildFusionDiagnosis({
    cnn: { season: "spring", scores: cnnScores },
    cnnCode: "OK",
    doubao: { result: makeVisionResult({ can_judge_reliably: false, lighting_warning: true }) },
  });
  assert.equal(result.source, "cnn");
  assert.equal(result.fallbackReason, "DOUBAO_UNRELIABLE");
  assert.equal(result.doubao.canJudgeReliably, false);
  assert.equal(result.doubao.lightingWarning, true);
  assert.equal(result.doubao.features, undefined);
  assert.equal(result.doubao.seasonScores, undefined);
});

test("CNN score failure with valid Doubao uses pure Doubao fallback", () => {
  const result = buildFusionDiagnosis({
    cnn: { season: "spring", scores: { spring: Number.NaN, summer: 0, autumn: 0, winter: 0 } },
    cnnCode: "CNN_INVALID_SCORES",
    doubao: { result: makeVisionResult() },
    doubaoCode: "OK",
  });
  assert.equal(result.source, "doubao");
  assert.deepEqual(result.effectiveWeights, { cnn: 0, doubao: 1 });
  assert.equal(result.fallbackReason, "CNN_INVALID_SCORES");
  assert.equal(result.predictedSeason, "summer");
  assert.deepEqual(result.doubao.features?.skin_undertone, "cool");
});

test("both models failing throws an explicit error with details", () => {
  assert.throws(
    () => buildFusionDiagnosis({
      cnn: null,
      doubao: null,
      cnnCode: "CNN_MISSING",
      doubaoCode: "DOUBAO_RATE_LIMITED",
    }),
    (error: unknown) => {
      assert.ok(error instanceof FusionUnavailableError);
      assert.deepEqual(error.details, { cnn: "CNN_MISSING", doubao: "DOUBAO_RATE_LIMITED" });
      return true;
    },
  );
});

test("fusion config defaults, legal override, and invalid weight rejection", () => {
  const disabled = readFusionConfig({ FUSION_ENABLED: "false", FUSION_CNN_WEIGHT: "abc" });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.cnnWeight, DEFAULT_CNN_WEIGHT);

  const enabled = readFusionConfig({ FUSION_ENABLED: "true", FUSION_CNN_WEIGHT: "0.25" });
  assert.deepEqual(enabled, { enabled: true, cnnWeight: 0.25, doubaoWeight: 0.75 });

  const defaultWeight = readFusionConfig({ FUSION_ENABLED: "true" });
  assert.equal(defaultWeight.cnnWeight, 0.4);

  for (const bad of ["abc", "1.5", "-0.1", "NaN"]) {
    assert.throws(() => readFusionConfig({ FUSION_ENABLED: "true", FUSION_CNN_WEIGHT: bad }), FusionConfigError);
  }
});

test("vision failures are mapped to stable codes", () => {
  assert.equal(classifyVisionFailure({ code: "RATE_LIMITED", status: 429 }), "DOUBAO_RATE_LIMITED");
  assert.equal(classifyVisionFailure({ code: "TIMEOUT" }), "DOUBAO_TIMEOUT");
  assert.equal(classifyVisionFailure({ code: "CONFIG_MISSING" }), "DOUBAO_CONFIG_MISSING");
  assert.equal(classifyVisionFailure({ status: 503 }), "DOUBAO_API_ERROR");
});
