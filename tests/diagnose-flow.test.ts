import test from "node:test";
import assert from "node:assert/strict";
import sharp, { type Sharp } from "sharp";
import { assessImageQuality, mergeFaceSignalIntoQuality } from "../src/lib/image-quality.ts";
import { assembleAdvancedDiagnosisFields } from "../src/lib/fusion-api.ts";
import { VisionResultSchema, type SeasonScores } from "../src/lib/vision-schema.ts";

/**
 * 生成带纹理的合成测试图：模拟有细节的人像照片（中等亮度、各通道均衡、有像素纹理）。
 * 纯色图拉普拉斯方差为 0，会被正确地判为模糊，不适合作为「正常照片」样图。
 */
async function png(transform?: (pipeline: Sharp) => Sharp): Promise<Uint8Array> {
  const width = 640;
  const height = 640;
  const raw = Buffer.alloc(width * height * 3);
  let seed = 20261123;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % 61;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const base = 120 + next();
      raw[offset] = base + 8;
      raw[offset + 1] = base + 2;
      raw[offset + 2] = base - 6;
    }
  }
  let pipeline = sharp(raw, { raw: { width, height, channels: 3 } });
  if (transform) pipeline = transform(pipeline);
  return new Uint8Array(await pipeline.png().toBuffer());
}

function vision(scores: SeasonScores) {
  const season = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  return { result: VisionResultSchema.parse({
    season_scores: scores,
    most_likely_season: season,
    skin_undertone: "neutral",
    brightness: "medium",
    saturation: "moderate",
    feature_contrast: "medium",
    lighting_warning: false,
    filter_warning: false,
    can_judge_reliably: true,
    reason: "观察到中性肤色与中等对比，据此推断。",
  }) };
}

test("flow: normal PNG passes image quality with resolution metrics", async () => {
  const quality = await assessImageQuality(await png());
  assert.equal(quality.metrics.width.value, 640);
  assert.equal(quality.metrics.height.value, 640);
  assert.equal(quality.metrics.meetsModelInput.value, 1);
  assert.notEqual(quality.qualityLevel, "REJECT");
  // 没有人脸信号时，人脸指标必须为 unknown 而不是默认通过
  assert.equal(quality.metrics.faceDetected.value, "unknown");
  assert.equal(quality.metrics.faceCount.value, "unknown");
});

test("flow: severely overexposed image rejected before paid API", async () => {
  const image = await png((p) => p.linear(6, 0));
  const quality = await assessImageQuality(image);
  assert.equal(quality.qualityLevel, "REJECT");
  assert.ok(quality.issues.some((issue) => issue.code === "OVEREXPOSED"));
  assert.ok(quality.recommendation.some((text) => text.includes("曝光过度") && text.includes("自然光")));
});

test("flow: severely underexposed image rejected", async () => {
  const image = await png((p) => p.linear(0.01, 0));
  const quality = await assessImageQuality(image);
  assert.equal(quality.qualityLevel, "REJECT");
  assert.ok(quality.issues.some((issue) => issue.code === "UNDEREXPOSED"));
});

test("flow: blurred image rejected", async () => {
  const noise = Buffer.alloc(640 * 640 * 3);
  for (let index = 0; index < noise.length; index += 1) noise[index] = (index * 37) % 256;
  const noisy = new Uint8Array(await sharp(noise, { raw: { width: 640, height: 640, channels: 3 } }).png().toBuffer());
  const sharpImage = await assessImageQuality(noisy);
  const blurredImage = new Uint8Array(await sharp(noisy).blur(20).png().toBuffer());
  const blurred = await assessImageQuality(blurredImage);
  assert.ok(
    (blurred.metrics.laplacianVariance.value as number) < (sharpImage.metrics.laplacianVariance.value as number),
  );
  assert.equal(blurred.qualityLevel, "REJECT");
  assert.ok(blurred.issues.some((issue) => issue.code === "SEVERE_BLUR"));
});

test("flow: low resolution rejected", async () => {
  const small = new Uint8Array(await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer());
  const quality = await assessImageQuality(small);
  assert.equal(quality.metrics.meetsModelInput.value, 0);
  assert.equal(quality.qualityLevel, "REJECT");
  assert.ok(quality.issues.some((issue) => issue.code === "RESOLUTION_TOO_LOW"));
});

test("flow: merged face signal can reject when no clear face", async () => {
  const base = await assessImageQuality(await png());
  const merged = mergeFaceSignalIntoQuality(base, { detected: false, confidence: 0.3, count: 0 });
  assert.equal(merged.qualityLevel, "REJECT");
  assert.ok(merged.issues.some((issue) => issue.code === "NO_CLEAR_FACE"));
  assert.ok(merged.issues.some((issue) => issue.code === "MULTIPLE_FACES") === false);
});

test("flow: adapter blocks RETAKE_REQUIRED without season/confidence", async () => {
  const quality = await assessImageQuality(await png((p) => p.linear(6, 0)));
  const result = assembleAdvancedDiagnosisFields({
    fusionEnabled: true,
    cnnWeight: 0.4,
    cnn: { season: "spring", scores: { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 } },
    cnnCode: "OK",
    doubao: vision({ spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 }),
    doubaoCode: "OK",
    imageQuality: quality,
    legacy: { seasonType: "spring", confidence: 0.9 },
  });
  assert.equal(result.blocked, true);
  assert.equal(result.diagnosisStatus, "RETAKE_REQUIRED");
  assert.equal("seasonType" in result, false);
  assert.equal("confidence" in result, false);
  assert.equal("scores" in result, false);
});

test("flow: adapter UNCERTAIN keeps candidates but flags status", async () => {
  const quality = await assessImageQuality(await png());
  const result = assembleAdvancedDiagnosisFields({
    fusionEnabled: true,
    cnnWeight: 0.4,
    cnn: { season: "summer", scores: { spring: 0.46, summer: 0.52, autumn: 0.01, winter: 0.01 } },
    cnnCode: "OK",
    doubao: vision({ spring: 0.45, summer: 0.31, autumn: 0.15, winter: 0.09 }),
    doubaoCode: "OK",
    imageQuality: quality,
    legacy: { seasonType: "summer", confidence: 0.52 },
  });
  assert.equal(result.blocked, false);
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.equal(result.fusionDiagnosis?.candidateSeasons.length, 2);
  assert.equal(result.fusionDiagnosis?.confidenceType, "uncalibrated_fusion_score");
});

test("flow: unknown metrics never default to PASS", async () => {
  const quality = await assessImageQuality(new Uint8Array([0, 1, 2]));
  assert.equal(quality.metrics.width.value, "unknown");
  assert.equal(quality.metrics.faceDetected.value, "unknown");
  assert.ok(quality.issues.some((issue) => issue.code === "LOCAL_PRECHECK_UNAVAILABLE"));
  assert.notEqual(quality.qualityLevel, "PASS");
});

// ---------- Phase 3.2：颜色分布异常分级 ----------

/** 生成通道偏移可控的合成图：offset 为红色通道相对其他通道的额外增益。 */
async function castPng(offset: number): Promise<Uint8Array> {
  const width = 640;
  const height = 640;
  const raw = Buffer.alloc(width * height * 3);
  let seed = 77771;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % 41;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const base = 110 + next();
      raw[i] = Math.min(255, base + offset);
      raw[i + 1] = base;
      raw[i + 2] = base;
    }
  }
  return new Uint8Array(await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer());
}

test("phase3.2 flow: color distribution anomaly is graded into three tiers", async () => {
  const mild = await assessImageQuality(await castPng(30));
  const mildCast = mild.metrics.channelCast.value as number;
  assert.ok(mildCast >= 0.11 && mildCast < 0.2, `expected mild cast, got ${mildCast}`);
  assert.ok(mild.issues.some((issue) => issue.code === "POSSIBLE_COLOR_CAST"));
  assert.ok(!mild.issues.some((issue) => issue.code === "SUSPECTED_COLOR_PROCESSING"));
  assert.ok(!mild.issues.some((issue) => issue.code === "SEVERE_COLOR_DISTORTION"));

  const strong = await assessImageQuality(await castPng(55));
  const strongCast = strong.metrics.channelCast.value as number;
  assert.ok(strongCast >= 0.2 && strongCast < 0.3, `expected strong cast, got ${strongCast}`);
  assert.ok(strong.issues.some((issue) => issue.code === "SUSPECTED_COLOR_PROCESSING"));
  assert.ok(!strong.issues.some((issue) => issue.code === "SEVERE_COLOR_DISTORTION"));

  const severe = await assessImageQuality(await castPng(85));
  const severeCast = severe.metrics.channelCast.value as number;
  assert.ok(severeCast >= 0.3, `expected severe cast, got ${severeCast}`);
  assert.ok(severe.issues.some((issue) => issue.code === "SEVERE_COLOR_DISTORTION"));
  // 颜色分布异常只降级诊断可靠性，绝不据此拒绝诊断。
  assert.notEqual(severe.qualityLevel, "REJECT");
  assert.ok(severe.issues.every((issue) => issue.code !== "OVEREXPOSED" && issue.code !== "UNDEREXPOSED"));
});

test("phase3.2 flow: severe color distortion downgrades to UNCERTAIN without blocking", async () => {
  const quality = await assessImageQuality(await castPng(85));
  const result = assembleAdvancedDiagnosisFields({
    fusionEnabled: true,
    cnnWeight: 0.4,
    cnn: { season: "spring", scores: { spring: 0.9, summer: 0.05, autumn: 0.03, winter: 0.02 } },
    cnnCode: "OK",
    doubao: vision({ spring: 0.88, summer: 0.06, autumn: 0.03, winter: 0.03 }),
    doubaoCode: "OK",
    imageQuality: quality,
    legacy: { seasonType: "spring", confidence: 0.9 },
  });
  assert.equal(result.blocked, false, "颜色分布异常不得阻断诊断");
  assert.equal(result.diagnosisStatus, "UNCERTAIN");
  assert.ok(result.decisiveReasons.includes("SEVERE_COLOR_DISTORTION"));
});

test("phase3.2 flow: image quality thresholds can be overridden for offline experiments", async () => {
  const image = await castPng(55);
  const strict = await assessImageQuality(image);
  const relaxed = await assessImageQuality(image, { thresholds: { channelCastWarning: 0.5, channelCastHigh: 0.6 } });
  assert.ok(strict.issues.some((issue) => issue.code === "SUSPECTED_COLOR_PROCESSING"));
  assert.ok(!relaxed.issues.some((issue) => issue.code === "SUSPECTED_COLOR_PROCESSING"));
  // 覆盖只影响本次评估，不改变任何持久化配置。
  assert.equal(strict.metrics.channelCast.value, relaxed.metrics.channelCast.value);
});
