import test from "node:test";
import assert from "node:assert/strict";
import {
  SEASON_KEYS,
  SEASON_SCORE_SUM_TOLERANCE,
  VisionResultSchema,
  describeSchemaIssues,
  type SeasonKey,
} from "../src/lib/vision-schema.ts";

const baseResult = {
  season_scores: { spring: 0.15, summer: 0.55, autumn: 0.1, winter: 0.2 },
  most_likely_season: "summer" as SeasonKey,
  skin_undertone: "cool" as const,
  brightness: "light" as const,
  saturation: "soft" as const,
  feature_contrast: "low" as const,
  lighting_warning: false,
  filter_warning: false,
  can_judge_reliably: true,
  reason: "观察到肤色偏冷白、整体明度较高，瞳色与肤色对比柔和，据此推断为夏季型。",
};

test("valid summer result parses and keeps scores normalized", () => {
  const parsed = VisionResultSchema.safeParse(baseResult);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  const sum = Object.values(parsed.data.season_scores).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(sum * 1e6) / 1e6, 1);
  assert.equal(parsed.data.most_likely_season, "summer");
});

test("all four season classifications parse", () => {
  for (const season of SEASON_KEYS) {
    const scores = { spring: 0.1, summer: 0.1, autumn: 0.1, winter: 0.1 };
    scores[season] = 0.7;
    const parsed = VisionResultSchema.safeParse({
      ...baseResult,
      season_scores: scores,
      most_likely_season: season,
    });
    assert.equal(parsed.success, true, `failed to parse ${season}`);
    if (parsed.success) {
      assert.equal(parsed.data.most_likely_season, season);
      assert.equal(parsed.data.season_scores[season], 0.7);
    }
  }
});

test("missing score field is rejected", () => {
  const parsed = VisionResultSchema.safeParse({
    ...baseResult,
    season_scores: { spring: 0.2, summer: 0.5, autumn: 0.3 },
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.ok(describeSchemaIssues(parsed.error).includes("season_scores.winter"));
});

test("negative and non-finite scores are rejected", () => {
  const negative = VisionResultSchema.safeParse({
    ...baseResult,
    season_scores: { ...baseResult.season_scores, summer: -0.2 },
  });
  assert.equal(negative.success, false);

  const nan = VisionResultSchema.safeParse({
    ...baseResult,
    season_scores: { ...baseResult.season_scores, summer: Number.NaN },
  });
  assert.equal(nan.success, false);

  const infinity = VisionResultSchema.safeParse({
    ...baseResult,
    season_scores: { ...baseResult.season_scores, summer: Number.POSITIVE_INFINITY },
  });
  assert.equal(infinity.success, false);
});

test("invalid JSON-shaped input (non-object) is rejected", () => {
  assert.equal(VisionResultSchema.safeParse("not json").success, false);
  assert.equal(VisionResultSchema.safeParse(null).success, false);
  assert.equal(VisionResultSchema.safeParse([]).success, false);
});

test("uncertain output with unknown features and unreliable flag is accepted", () => {
  const uncertain = {
    ...baseResult,
    skin_undertone: "unknown",
    brightness: "unknown",
    saturation: "unknown",
    feature_contrast: "unknown",
    lighting_warning: true,
    filter_warning: true,
    can_judge_reliably: false,
    reason: "画面严重过曝且带有强滤镜，自然发色与瞳色均不可观察，无法可靠判断。",
  };
  const parsed = VisionResultSchema.safeParse(uncertain);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.can_judge_reliably, false);
});

test("unreliable judgement requires an explanatory reason", () => {
  const parsed = VisionResultSchema.safeParse({
    ...baseResult,
    can_judge_reliably: false,
    reason: "不清楚",
  });
  assert.equal(parsed.success, false);
});

test("schema mismatch cases are rejected", () => {
  const outOfRangeSum = VisionResultSchema.safeParse({
    ...baseResult,
    season_scores: { spring: 2, summer: 3, autumn: 2, winter: 3 },
  });
  assert.equal(outOfRangeSum.success, false);

  const inconsistentWinner = VisionResultSchema.safeParse({
    ...baseResult,
    most_likely_season: "autumn",
  });
  assert.equal(inconsistentWinner.success, false);

  const extraField = VisionResultSchema.safeParse({ ...baseResult, unexpected: "value" });
  assert.equal(extraField.success, false);

  const badEnum = VisionResultSchema.safeParse({ ...baseResult, skin_undertone: "warm-ish" });
  assert.equal(badEnum.success, false);

  const tooLongReason = VisionResultSchema.safeParse({ ...baseResult, reason: "x".repeat(601) });
  assert.equal(tooLongReason.success, false);
});

test("scores slightly off 1 are normalized instead of rejected", () => {
  const parsed = VisionResultSchema.safeParse({
    ...baseResult,
    season_scores: { spring: 0.14, summer: 0.52, autumn: 0.1, winter: 0.19 },
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    const sum = Object.values(parsed.data.season_scores).reduce((a, b) => a + b, 0);
    assert.equal(Math.round(sum * 1e6) / 1e6, 1);
  }
  assert.ok(SEASON_SCORE_SUM_TOLERANCE > 0);
});
