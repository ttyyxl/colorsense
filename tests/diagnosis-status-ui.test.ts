import test from "node:test";
import assert from "node:assert/strict";
import {
  labelForReason,
  presentationForStatus,
  resolveSeasonScoreView,
  splitReasons,
} from "../src/lib/diagnosis-status-ui.ts";

test("CONFIDENT shows formal season and downstream actions", () => {
  const presentation = presentationForStatus("CONFIDENT");
  assert.equal(presentation.showFormalSeason, true);
  assert.equal(presentation.showDownstreamActions, true);
  assert.equal(presentation.showRetake, false);
});

test("UNCERTAIN still shows formal season and downstream actions with an uncertainty note", () => {
  // Phase 3.3：诊断可信程度与业务可执行性解耦——低置信度不再阻断展示与后续建议。
  const presentation = presentationForStatus("UNCERTAIN");
  assert.equal(presentation.showFormalSeason, true);
  assert.equal(presentation.showCandidates, true);
  assert.equal(presentation.showRetake, true);
  assert.equal(presentation.showDownstreamActions, true);
  assert.equal(presentation.carriesUncertainty, true);
  assert.match(presentation.description, /不确定性/);
});

test("RETAKE_REQUIRED shows neither formal season nor candidates", () => {
  const presentation = presentationForStatus("RETAKE_REQUIRED");
  assert.equal(presentation.showFormalSeason, false);
  assert.equal(presentation.showCandidates, false);
  assert.equal(presentation.showRetake, true);
  assert.equal(presentation.showDownstreamActions, false);
});

test("DEGRADED still shows formal season and downstream actions with limitations", () => {
  // Phase 3.3：单模型降级同样允许展示季型并生成后续建议。
  const presentation = presentationForStatus("DEGRADED");
  assert.equal(presentation.showFormalSeason, true);
  assert.equal(presentation.showCandidates, true);
  assert.equal(presentation.showDownstreamActions, true);
  assert.equal(presentation.carriesUncertainty, true);
});

test("FAILED hides season and offers retry", () => {
  const presentation = presentationForStatus("FAILED");
  assert.equal(presentation.showFormalSeason, false);
  assert.equal(presentation.showRetake, true);
  assert.equal(presentation.showDownstreamActions, false);
});

test("legacy records without status default to CONFIDENT", () => {
  assert.equal(presentationForStatus(undefined).showFormalSeason, true);
  assert.equal(presentationForStatus("v1-legacy").showFormalSeason, true);
});

test("reason codes map to user-facing labels", () => {
  assert.match(labelForReason("TOP_GAP_BELOW_THRESHOLD"), /分数接近/);
  assert.match(labelForReason("IMAGE_QUALITY_REJECT"), /质量/);
  assert.equal(labelForReason("UNKNOWN_CODE"), "UNKNOWN_CODE");
});

// ---------- Phase 3.2：软警告与决定性原因分离 ----------

test("phase3.2: risk split separates decisive reasons from soft warnings", () => {
  const risks = [
    { reason: "IMAGE_QUALITY_WARNING", level: "SOFT_WARNING" as const, group: "image-condition" },
    { reason: "DOUBAO_LIGHTING_WARNING", level: "SOFT_WARNING" as const, group: "image-condition" },
    { reason: "TOP_GAP_BELOW_THRESHOLD", level: "DECISIVE_RISK" as const, group: "score-margin" },
  ];
  const split = splitReasons(["IMAGE_QUALITY_WARNING", "DOUBAO_LIGHTING_WARNING", "TOP_GAP_BELOW_THRESHOLD"], risks);
  assert.deepEqual(split.decisive, ["TOP_GAP_BELOW_THRESHOLD"]);
  assert.deepEqual(split.soft, ["IMAGE_QUALITY_WARNING", "DOUBAO_LIGHTING_WARNING"]);
});

test("phase3.2: legacy records without risks fall back to known soft-warning codes", () => {
  const split = splitReasons(["IMAGE_QUALITY_WARNING", "MODEL_TOP1_MISMATCH", "TOP_SCORE_BELOW_THRESHOLD"], undefined);
  assert.deepEqual(split.decisive, ["TOP_SCORE_BELOW_THRESHOLD"]);
  assert.deepEqual(split.soft, ["IMAGE_QUALITY_WARNING", "MODEL_TOP1_MISMATCH"]);
});

test("phase3.2: doubao refusal has its own label distinct from service failure", () => {
  assert.match(labelForReason("DOUBAO_REFUSED"), /无法支持可靠判断/);
  assert.match(labelForReason("SINGLE_MODEL_DEGRADED"), /服务不可用/);
  assert.match(labelForReason("MULTIPLE_INDEPENDENT_RISKS"), /相互独立/);
});

// ---------- 四季综合匹配度：评分视图解析（结果页展示优化） ----------
//
// 展示层不重复加权计算：双模型融合成功时直接读取后端已完成权重融合与归一化的
// fusionDiagnosis.seasonScores；融合未启用或单模型降级时使用实际有效的最终诊断评分
// diagnosis.scores，并明确标识来源，不得伪装成双模型融合结果。

const FUSED_SCORES = { spring: 0.52, summer: 0.18, autumn: 0.2, winter: 0.1 };
const CNN_SCORES = { spring: 0.6, summer: 0.15, autumn: 0.15, winter: 0.1 };
const DOUBAO_SCORES = { spring: 0.45, summer: 0.2, autumn: 0.25, winter: 0.1 };

function makeFusionDiagnosis(overrides: Record<string, unknown> = {}) {
  return {
    version: "2.0",
    predictedSeason: "spring",
    seasonScores: FUSED_SCORES,
    source: "fusion",
    requestedWeights: { cnn: 0.4, doubao: 0.6 },
    effectiveWeights: { cnn: 0.4, doubao: 0.6 },
    cnn: { available: true, predictedSeason: "spring", seasonScores: CNN_SCORES },
    doubao: { available: true, predictedSeason: "spring", seasonScores: DOUBAO_SCORES },
    fallbackReason: null,
    ...overrides,
  };
}

test("season scores: dual-model agreement with successful fusion uses fused seasonScores", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: FUSED_SCORES,
    fusionDiagnosis: makeFusionDiagnosis(),
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, true);
  assert.deepEqual(view.scores, FUSED_SCORES);
  assert.equal(view.topSeason, "spring");
  assert.equal(view.weightLabel, "专业模型 40% · 视觉模型 60%");
  assert.match(view.sourceLabel, /双模型/);
});

test("season scores: dual-model disagreement still uses fused seasonScores, never raw model scores", () => {
  // 双模型首选季型不一致时仍然是融合成功，展示的必须是融合分数而非任一单模型分数。
  const view = resolveSeasonScoreView({
    source: "model",
    scores: FUSED_SCORES,
    fusionDiagnosis: makeFusionDiagnosis({
      cnn: { available: true, predictedSeason: "summer", seasonScores: CNN_SCORES },
      doubao: { available: true, predictedSeason: "autumn", seasonScores: DOUBAO_SCORES },
    }),
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, true);
  assert.deepEqual(view.scores, FUSED_SCORES);
  assert.notDeepEqual(view.scores, CNN_SCORES);
  assert.notDeepEqual(view.scores, DOUBAO_SCORES);
});

test("season scores: top score below 50% is still displayed as a valid fusion result", () => {
  const lowTop = { spring: 0.42, summer: 0.3, autumn: 0.18, winter: 0.1 };
  const view = resolveSeasonScoreView({
    source: "model",
    scores: lowTop,
    fusionDiagnosis: makeFusionDiagnosis({ seasonScores: lowTop }),
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, true);
  assert.equal(view.topSeason, "spring");
});

test("season scores: doubao failure degrades to cnn and is labelled as single-model", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: CNN_SCORES,
    fusionDiagnosis: makeFusionDiagnosis({
      source: "cnn",
      seasonScores: CNN_SCORES,
      effectiveWeights: { cnn: 1, doubao: 0 },
      fallbackReason: "DOUBAO_TIMEOUT",
      doubao: { available: false },
    }),
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, false);
  assert.equal(view.weightLabel, null);
  assert.deepEqual(view.scores, CNN_SCORES);
  assert.match(view.sourceLabel, /专业模型/);
  assert.doesNotMatch(view.sourceLabel, /双模型/);
});

test("season scores: fusion disabled records use diagnosis.scores without fusion pose", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: CNN_SCORES,
    fusionDiagnosis: undefined,
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, false);
  assert.equal(view.weightLabel, null);
  assert.deepEqual(view.scores, CNN_SCORES);
  assert.match(view.sourceLabel, /专业模型/);
});

test("season scores: legacy records without fusionDiagnosis fall back to diagnosis.scores", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: FUSED_SCORES,
    fusionDiagnosis: undefined,
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, false);
  assert.equal(view.topSeason, "spring");
});

test("season scores: rules-based diagnosis is labelled as basic color analysis", () => {
  const view = resolveSeasonScoreView({
    source: "rules",
    scores: FUSED_SCORES,
    fusionDiagnosis: undefined,
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, false);
  assert.match(view.sourceLabel, /基础色彩分析/);
});

test("season scores: missing score fields produce no view instead of fabricated scores", () => {
  assert.equal(resolveSeasonScoreView({ source: "model" }), null);
  assert.equal(
    resolveSeasonScoreView({ source: "model", fusionDiagnosis: makeFusionDiagnosis({ seasonScores: undefined }) }),
    null,
  );
  assert.equal(
    resolveSeasonScoreView({ source: "model", fusionDiagnosis: makeFusionDiagnosis({ source: "cnn", seasonScores: undefined }) }),
    null,
  );
  assert.equal(resolveSeasonScoreView({ source: "model", scores: undefined }), null);
  assert.equal(
    resolveSeasonScoreView({ source: "model", scores: { spring: NaN, summer: Number.NaN } }),
    null,
  );
});

test("season scores: only seasons with valid numbers are shown", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: { spring: 0.5, summer: 0.3, autumn: "0.1" as unknown as number },
    fusionDiagnosis: undefined,
  });
  assert.ok(view);
  assert.deepEqual(view.scores, { spring: 0.5, summer: 0.3 });
  assert.equal(view.topSeason, "spring");
});

test("season scores: effective weights are read dynamically from fusionDiagnosis", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: FUSED_SCORES,
    fusionDiagnosis: makeFusionDiagnosis({ effectiveWeights: { cnn: 0.35, doubao: 0.65 } }),
  });
  assert.ok(view);
  assert.equal(view.weightLabel, "专业模型 35% · 视觉模型 65%");
});

test("season scores: fusion without effective weights keeps fusion label but no weight line", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: FUSED_SCORES,
    fusionDiagnosis: makeFusionDiagnosis({ effectiveWeights: undefined }),
  });
  assert.ok(view);
  assert.equal(view.isDualFusion, true);
  assert.equal(view.weightLabel, null);
});

test("season scores: top season always matches the argmax of the displayed scores", () => {
  const scores = { spring: 0.1, summer: 0.55, autumn: 0.25, winter: 0.1 };
  const view = resolveSeasonScoreView({
    source: "model",
    scores,
    fusionDiagnosis: makeFusionDiagnosis({ seasonScores: scores, predictedSeason: "summer" }),
  });
  assert.ok(view);
  assert.equal(view.topSeason, "summer");
});

test("season scores: fused percentages sum to approximately 100%", () => {
  const view = resolveSeasonScoreView({
    source: "model",
    scores: FUSED_SCORES,
    fusionDiagnosis: makeFusionDiagnosis(),
  });
  assert.ok(view);
  const sum = Object.values(view.scores).reduce((acc, value) => acc + value, 0);
  assert.ok(Math.abs(sum - 1) < 0.01);
});
