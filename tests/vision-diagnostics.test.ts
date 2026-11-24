import test from "node:test";
import assert from "node:assert/strict";
import {
  isVisionDiagnosticsLogEnabled,
  logVisionDiagnostics,
} from "../src/lib/vision-diagnostics.ts";
import { assembleDiagnosisFields } from "../src/lib/fusion-api.ts";

function captureInfo<T>(fn: () => T): { value: T; lines: unknown[][] } {
  const info = console.info;
  const lines: unknown[][] = [];
  console.info = (...args: unknown[]) => {
    lines.push(args);
  };
  try {
    return { value: fn(), lines };
  } finally {
    console.info = info;
  }
}

test("diagnostics log is disabled by default and for non-true values", () => {
  assert.equal(isVisionDiagnosticsLogEnabled({}), false);
  assert.equal(isVisionDiagnosticsLogEnabled({ VISION_DIAGNOSTICS_LOG_ENABLED: "0" }), false);
  assert.equal(isVisionDiagnosticsLogEnabled({ VISION_DIAGNOSTICS_LOG_ENABLED: "yes" }), false);

  const { lines } = captureInfo(() =>
    logVisionDiagnostics(
      "vision.result",
      { modelId: "hidden-model", canJudgeReliably: false },
      {},
    ),
  );
  assert.equal(lines.length, 0);
});

test("enabled diagnostics log emits only allowlisted safe fields", () => {
  const { lines } = captureInfo(() =>
    logVisionDiagnostics(
      "vision.result",
      {
        modelId: "doubao-lite",
        durationMs: 123,
        canJudgeReliably: false,
        lightingWarning: true,
        filterWarning: true,
        requestId: "req-abc-123",
        promptTokens: 40,
        completionTokens: 20,
        fallbackReason: "DOUBAO_UNRELIABLE",
        // 以下都不得进入日志
        apiKey: "SECRET_KEY_SHOULD_NEVER_APPEAR",
        reason: "自然语言拒判理由不应记录",
        dataUrl: "data:image/jpeg;base64,AAAA",
        prompt: "完整系统提示词",
        longRequestId: "x".repeat(200),
        brokenNumber: Number.NaN,
      },
      { VISION_DIAGNOSTICS_LOG_ENABLED: " TRUE " },
    ),
  );

  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], "[vision-diagnostics] vision.result");
  const logged = lines[0][1] as Record<string, unknown>;
  assert.deepEqual(logged, {
    modelId: "doubao-lite",
    durationMs: 123,
    canJudgeReliably: false,
    lightingWarning: true,
    filterWarning: true,
    requestId: "req-abc-123",
    promptTokens: 40,
    completionTokens: 20,
    fallbackReason: "DOUBAO_UNRELIABLE",
  });
  const serialized = JSON.stringify(logged);
  assert.ok(!serialized.includes("SECRET"));
  assert.ok(!serialized.includes("data:image"));
  assert.ok(!serialized.includes("自然语言"));
});

test("fusion adapter logs source and fallbackReason without scores", () => {
  const envKey = "VISION_DIAGNOSTICS_LOG_ENABLED";
  const previous = process.env[envKey];
  process.env[envKey] = "true";
  try {
    const { value, lines } = captureInfo(() =>
      assembleDiagnosisFields({
        fusionEnabled: true,
        cnnWeight: 0.4,
        cnn: {
          season: "summer",
          scores: { spring: 0.1, summer: 0.6, autumn: 0.1, winter: 0.2 },
        },
        doubao: null,
        doubaoCode: "DOUBAO_UNRELIABLE",
        legacy: { seasonType: "summer", confidence: 0.6 },
      }),
    );
    assert.equal(value.fusionDiagnosis?.source, "cnn");
    assert.equal(value.fusionDiagnosis?.fallbackReason, "DOUBAO_UNRELIABLE");
    assert.equal(lines.length, 1);
    assert.equal(lines[0][0], "[vision-diagnostics] fusion.result");
    const logged = lines[0][1] as Record<string, unknown>;
    assert.equal(logged.source, "cnn");
    assert.equal(logged.fallbackReason, "DOUBAO_UNRELIABLE");
    assert.equal(logged.cnnWeight, 0.4);
    assert.ok(!("scores" in logged));
    assert.ok(!("seasonScores" in logged));
  } finally {
    if (previous === undefined) delete process.env[envKey];
    else process.env[envKey] = previous;
  }
});
