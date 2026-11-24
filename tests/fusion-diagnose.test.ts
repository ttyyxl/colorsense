import test from "node:test";
import assert from "node:assert/strict";
import {
  assembleDiagnosisFields,
  buildDiagnosisRecord,
  type AssembleDiagnosisInput,
} from "../src/lib/fusion-api.ts";
import { VisionResultSchema, type SeasonScores, type VisionResult } from "../src/lib/vision-schema.ts";

const cnnScores: SeasonScores = { spring: 0.4, summer: 0.3, autumn: 0.2, winter: 0.1 };
const cnnTopSeason = "spring" as const;

function makeVisionResult(overrides: Record<string, unknown> = {}): VisionResult {
  return VisionResultSchema.parse({
    season_scores: { spring: 0.067, summer: 0.633, autumn: 0.067, winter: 0.233 },
    most_likely_season: "summer",
    skin_undertone: "cool",
    brightness: "light",
    saturation: "soft",
    feature_contrast: "low",
    lighting_warning: false,
    filter_warning: false,
    can_judge_reliably: true,
    reason: "观察到冷调肤色与柔和对比，据此推断为夏季型。",
    ...overrides,
  });
}

const baseInput: AssembleDiagnosisInput = {
  fusionEnabled: true,
  cnnWeight: 0.4,
  cnn: { season: cnnTopSeason, scores: cnnScores },
  cnnCode: "OK",
  doubao: { result: makeVisionResult() },
  doubaoCode: "OK",
  legacy: { seasonType: cnnTopSeason, confidence: 0.4, scores: cnnScores },
};

test("FUSION_ENABLED=false keeps legacy fields and omits fusionDiagnosis", () => {
  const fields = assembleDiagnosisFields({ ...baseInput, fusionEnabled: false });
  assert.equal(fields.seasonType, cnnTopSeason);
  assert.equal(fields.confidence, 0.4);
  assert.deepEqual(fields.scores, cnnScores);
  assert.equal("fusionDiagnosis" in fields, false);

  const record = buildDiagnosisRecord(fields, { userId: "mock-user", createdAt: "mock-time" });
  assert.equal("fusionDiagnosis" in record, false);
});

test("FUSION_ENABLED=true returns full fusion structure without top-level conflicts", () => {
  const fields = assembleDiagnosisFields(baseInput);
  const fusion = fields.fusionDiagnosis;
  assert.ok(fusion);
  assert.equal(fusion.version, "1.0");
  assert.equal(fusion.source, "fusion");
  assert.deepEqual(fusion.requestedWeights, { cnn: 0.4, doubao: 0.6 });
  assert.deepEqual(fusion.effectiveWeights, { cnn: 0.4, doubao: 0.6 });
  assert.equal(fusion.predictedSeason, "summer");
  assert.equal(fields.seasonType, fusion.predictedSeason);
  assert.equal(fields.confidence, fusion.seasonScores.summer);
  assert.deepEqual(fields.scores, fusion.seasonScores);
  assert.deepEqual(fusion.cnn.seasonScores, cnnScores);
  assert.deepEqual(fusion.doubao.seasonScores, makeVisionResult().season_scores);
  assert.deepEqual(fusion.doubao.features, {
    skin_undertone: "cool",
    brightness: "light",
    saturation: "soft",
    feature_contrast: "low",
  });
});

test("Doubao failure in adapter downgrades to CNN", () => {
  const fields = assembleDiagnosisFields({
    ...baseInput,
    doubao: null,
    doubaoCode: "DOUBAO_RATE_LIMITED",
  });
  assert.equal(fields.seasonType, cnnTopSeason);
  assert.equal(fields.fusionDiagnosis?.source, "cnn");
  assert.equal(fields.fusionDiagnosis?.fallbackReason, "DOUBAO_RATE_LIMITED");
  assert.deepEqual(fields.fusionDiagnosis?.effectiveWeights, { cnn: 1, doubao: 0 });
  assert.equal(fields.confidence, fields.fusionDiagnosis?.seasonScores.spring);
});

test("Doubao rejection in adapter exposes warnings but no features", () => {
  const fields = assembleDiagnosisFields({
    ...baseInput,
    doubao: { result: makeVisionResult({ can_judge_reliably: false, lighting_warning: true, filter_warning: true }) },
  });
  const fusion = fields.fusionDiagnosis;
  assert.equal(fusion?.source, "cnn");
  assert.equal(fusion?.fallbackReason, "DOUBAO_UNRELIABLE");
  assert.equal(fusion?.doubao.features, undefined);
  assert.equal(fusion?.doubao.lightingWarning, true);
  assert.equal(fusion?.doubao.filterWarning, true);
});

test("CNN-only-invalid path in adapter uses Doubao result", () => {
  const fields = assembleDiagnosisFields({
    ...baseInput,
    cnn: { season: cnnTopSeason, scores: { spring: 0, summer: 0, autumn: 0, winter: 0 } },
    cnnCode: "CNN_INVALID_SCORES",
  });
  assert.equal(fields.fusionDiagnosis?.source, "doubao");
  assert.equal(fields.fusionDiagnosis?.fallbackReason, "CNN_INVALID_SCORES");
  assert.equal(fields.seasonType, "summer");
});

test("Doubao call metadata is aligned with VisionCallMeta", () => {
  const meta = {
    modelId: "mock-model-id",
    durationMs: 987,
    attempts: 1,
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      reasoning_tokens: 0,
      total_tokens: 30,
      source: "api_usage" as const,
    },
    responseFormat: "json_schema" as const,
    response: {
      httpStatus: 200,
      finishReason: "stop",
      contentLength: 100,
      contentEmpty: false,
      reasoningContentPresent: false,
      reasoningContentLength: 0,
      promptTokens: 10,
      completionTokens: 20,
      reasoningTokens: 0,
      totalTokens: 30,
      requestId: null,
      modelReturned: null,
    },
    image: { mimeType: "image/png" as const, originalBytes: 10, sentBytes: 10, metadataStripped: false },
  };
  const fusion = assembleDiagnosisFields({
    ...baseInput,
    doubao: { result: makeVisionResult(), meta },
  }).fusionDiagnosis;
  assert.equal(fusion?.meta?.doubaoModelId, "mock-model-id");
  assert.equal(fusion?.meta?.doubaoDurationMs, 987);
  assert.equal(fusion?.meta?.doubaoUsage?.total_tokens, 30);
  assert.equal("response" in (fusion?.meta ?? {}), false); // 不保存完整内部诊断
});

test("API response data and Firestore record share the same fusion result", () => {
  const fields = assembleDiagnosisFields(baseInput);
  const doubaoAdvice = { source: "mock" };
  const responseData = { ...fields, doubaoAdvice };
  const record = buildDiagnosisRecord(fields, {
    doubaoAdvice,
    userId: "mock-user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.strictEqual(record.fusionDiagnosis, responseData.fusionDiagnosis);
  assert.deepEqual(record.scores, responseData.scores);
  assert.equal(record.seasonType, responseData.seasonType);
  assert.equal(record.confidence, responseData.confidence);
  assert.equal(record.userId, "mock-user");
  // 不得把密钥、Prompt 或原始响应写入数据库记录
  assert.equal("apiKey" in record, false);
  assert.equal("prompt" in record, false);
});

test("record builder omits undefined optional fields for backward compatibility", () => {
  const legacyFields = assembleDiagnosisFields({ ...baseInput, fusionEnabled: false, legacy: { seasonType: cnnTopSeason, confidence: 0.4 } });
  const record = buildDiagnosisRecord(legacyFields, { userId: "mock-user" });
  assert.equal("scores" in record, false);
  assert.equal("fusionDiagnosis" in record, false);
});
