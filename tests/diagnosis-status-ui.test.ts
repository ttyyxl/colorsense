import test from "node:test";
import assert from "node:assert/strict";
import { labelForReason, presentationForStatus, splitReasons } from "../src/lib/diagnosis-status-ui.ts";

test("CONFIDENT shows formal season and downstream actions", () => {
  const presentation = presentationForStatus("CONFIDENT");
  assert.equal(presentation.showFormalSeason, true);
  assert.equal(presentation.showDownstreamActions, true);
  assert.equal(presentation.showRetake, false);
});

test("UNCERTAIN shows candidates but no formal season or OOTD", () => {
  const presentation = presentationForStatus("UNCERTAIN");
  assert.equal(presentation.showFormalSeason, false);
  assert.equal(presentation.showCandidates, true);
  assert.equal(presentation.showRetake, true);
  assert.equal(presentation.showDownstreamActions, false);
});

test("RETAKE_REQUIRED shows neither formal season nor candidates", () => {
  const presentation = presentationForStatus("RETAKE_REQUIRED");
  assert.equal(presentation.showFormalSeason, false);
  assert.equal(presentation.showCandidates, false);
  assert.equal(presentation.showRetake, true);
});

test("DEGRADED shows candidates with limitations", () => {
  const presentation = presentationForStatus("DEGRADED");
  assert.equal(presentation.showCandidates, true);
  assert.equal(presentation.showDownstreamActions, false);
});

test("FAILED hides season and offers retry", () => {
  const presentation = presentationForStatus("FAILED");
  assert.equal(presentation.showFormalSeason, false);
  assert.equal(presentation.showRetake, true);
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
