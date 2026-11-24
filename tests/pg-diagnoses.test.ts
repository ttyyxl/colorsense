import test from "node:test";
import assert from "node:assert/strict";
import type { DiagnosisRow } from "../src/lib/server/diagnoses.ts";
import type { FusionDiagnosis } from "../src/lib/fusion.ts";
import type { NewDiagnosis } from "../src/lib/types.ts";

const { buildDiagnosisInsert, toDiagnosis } = await import("../src/lib/server/diagnoses.ts");

const scores = { spring: 0.2, summer: 0.6, autumn: 0.1, winter: 0.1 };
const fusionDiagnosis: FusionDiagnosis = {
  version: "1.0",
  predictedSeason: "summer",
  seasonScores: scores,
  source: "fusion",
  requestedWeights: { cnn: 0.4, doubao: 0.6 },
  effectiveWeights: { cnn: 0.4, doubao: 0.6 },
  cnn: { available: true, predictedSeason: "spring", seasonScores: scores },
  doubao: { available: true, predictedSeason: "summer", seasonScores: scores },
  fallbackReason: null,
};

const input: NewDiagnosis = {
  seasonType: "summer",
  confidence: 0.6,
  colorPalette: ["#FFB5A7", "#B0D8FF"],
  styleKeywords: ["清透", "柔和"],
  avoidColors: ["#000000"],
  aiDescription: "冷调柔和",
  labFeatures: { L: 62, a: 7, b: 12 },
  source: "model",
  scores,
  fusionDiagnosis,
  diagnosisStatus: "UNCERTAIN",
  inferenceMode: "dual",
  uncertaintyReasons: ["MODEL_DISAGREEMENT"],
  risks: [{ reason: "MODEL_DISAGREEMENT", level: "DECISIVE_RISK", group: "model-agreement" }],
  decisiveReasons: ["MODEL_DISAGREEMENT"],
  softWarnings: ["POSSIBLE_COLOR_CAST"],
  recommendations: ["请在自然光下重新拍摄以复核结果。"],
  hasValidSeasonResult: true,
};

test("PostgreSQL insert and row mapping preserve all fusion diagnosis fields", () => {
  const insert = buildDiagnosisInsert("cloudbase-user", input);
  assert.equal(insert.user_id, "cloudbase-user");
  assert.equal(insert.season_type, input.seasonType);
  assert.strictEqual(insert.fusion_diagnosis, input.fusionDiagnosis);
  assert.deepEqual(insert.scores, input.scores);
  assert.equal(insert.diagnosis_status, "UNCERTAIN");
  assert.equal(insert.inference_mode, "dual");
  assert.deepEqual(insert.uncertainty_reasons, input.uncertaintyReasons);
  assert.deepEqual(insert.risks, input.risks);
  assert.deepEqual(insert.decisive_reasons, input.decisiveReasons);
  assert.deepEqual(insert.soft_warnings, input.softWarnings);
  assert.deepEqual(insert.recommendations, input.recommendations);
  assert.equal(insert.has_valid_season_result, true);
  assert.equal("apiKey" in insert, false);
  assert.equal("prompt" in insert, false);

  const row: DiagnosisRow = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    created_at: "2026-01-01T00:00:00.000Z",
    ...insert,
  };
  const diagnosis = toDiagnosis(row);
  assert.equal(diagnosis.id, row.id);
  assert.equal(diagnosis.userId, "cloudbase-user");
  assert.equal(diagnosis.createdAt, row.created_at);
  assert.strictEqual(diagnosis.fusionDiagnosis, input.fusionDiagnosis);
  assert.deepEqual(diagnosis.scores, input.scores);
  assert.equal(diagnosis.diagnosisStatus, input.diagnosisStatus);
  assert.equal(diagnosis.inferenceMode, input.inferenceMode);
  assert.deepEqual(diagnosis.uncertaintyReasons, input.uncertaintyReasons);
  assert.deepEqual(diagnosis.risks, input.risks);
  assert.deepEqual(diagnosis.decisiveReasons, input.decisiveReasons);
  assert.deepEqual(diagnosis.softWarnings, input.softWarnings);
  assert.deepEqual(diagnosis.recommendations, input.recommendations);
  assert.equal(diagnosis.hasValidSeasonResult, true);
});

test("legacy PostgreSQL rows with NULL fusion fields remain compatible", () => {
  const legacyInput: NewDiagnosis = {
    seasonType: "spring",
    confidence: 0.8,
    colorPalette: [],
    styleKeywords: [],
    avoidColors: [],
    aiDescription: "",
    labFeatures: { L: 60, a: 5, b: 10 },
    source: "model",
  };
  const insert = buildDiagnosisInsert("legacy-user", legacyInput);
  for (const key of [
    "scores",
    "fusion_diagnosis",
    "diagnosis_status",
    "inference_mode",
    "uncertainty_reasons",
    "risks",
    "decisive_reasons",
    "soft_warnings",
    "recommendations",
    "has_valid_season_result",
  ]) {
    assert.equal(insert[key as keyof typeof insert], null);
  }

  const row: DiagnosisRow = {
    id: "223e4567-e89b-42d3-a456-426614174000",
    created_at: "2026-01-01T00:00:00.000Z",
    ...insert,
    face_detected: null,
    used_original_image: null,
    face_confidence: null,
    ai_advice: null,
    doubao_advice: null,
  };
  const diagnosis = toDiagnosis(row);
  for (const key of [
    "scores",
    "fusionDiagnosis",
    "diagnosisStatus",
    "inferenceMode",
    "uncertaintyReasons",
    "risks",
    "decisiveReasons",
    "softWarnings",
    "recommendations",
    "hasValidSeasonResult",
  ]) {
    assert.equal(key in diagnosis, false, `${key} should be omitted for a legacy row`);
  }
});
