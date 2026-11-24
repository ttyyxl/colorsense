/**
 * Phase 3.2 离线综合分析（零付费 API 调用，全部复用 Phase 3.1 真实缓存）。
 *
 * 统一入口：所有诊断结论都通过生产决策模块 buildAdvancedDiagnosis() 产生，
 * 不在本脚本内另写一套融合/状态判断逻辑。
 *
 * 能力：
 * - 一致性校验：legacy 策略复现 Phase 3.1 结论，并定位统计口径差异来源。
 * - 96 张第一轮图片全量重放（质量门控 → 权重 → 融合 → 分歧 → 风险分层 → 状态）。
 * - 方案 A~F 逐步对照（每项改动单独带来的影响）。
 * - 不确定性阈值单因素扫描、融合分差扫描、TVD 扫描、单模型分差扫描。
 * - 色偏阈值离线分析（复用 768 张免费预检的 channelCast 指标）。
 * - 固定权重对照（纯分类 + 综合诊断两种口径）。
 * - 数据集划分与泄漏修正记录。
 *
 * 输出：results/phase3.2_analysis.json（唯一结果文件）+ stdout 摘要。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessImageQuality, mergeFaceSignalIntoQuality } from "../../../src/lib/image-quality.ts";
import { buildAdvancedDiagnosis } from "../../../src/lib/advanced-diagnosis.ts";

const EXP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (name) => path.join(EXP, "results", name);

// ---------- 读取工具 ----------
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const h = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === "," && !q) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur); return Object.fromEntries(h.map((k, i) => [k, cells[i] ?? ""]));
  });
}
const readJsonl = (p) => (existsSync(p)
  ? readFileSync(p, "utf-8").trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
  : []);
const num = (v) => (v === "none" || v === "unknown" || v === "" || v === undefined ? null : Number(v));
const ratio = (a, b) => (b ? Number((a / b).toFixed(4)) : null);
const SEASONS = ["spring", "summer", "autumn", "winter"];

const manifest = parseCsv(readFileSync(path.join(EXP, "sample_manifest.csv"), "utf-8"));
const round1 = manifest.filter((r) => r.dataset_split === "round1_and_calibration");
const cnnBy = new Map(readJsonl(R("cnn_results.jsonl")).map((r) => [r.imageId, r]));
const dbBy = new Map(readJsonl(R("doubao_results.jsonl")).map((r) => [r.imageId, r]));
const phase31 = parseCsv(readFileSync(R("fusion_results.csv"), "utf-8"));
const phase31By = new Map(phase31.map((r) => [r.imageId, r]));
const qualityAll = parseCsv(readFileSync(R("image_quality_results.csv"), "utf-8"));

// ---------- 质量评估（带阈值覆盖的本地免费计算） ----------
const qualityCache = new Map();
async function qualityFor(row, qualityThresholds) {
  const key = `${row.image_id}|${qualityThresholds ? JSON.stringify(qualityThresholds) : "default"}`;
  if (qualityCache.has(key)) return qualityCache.get(key);
  const bytes = new Uint8Array(readFileSync(row.image_path));
  const cnn = cnnBy.get(row.image_id);
  const cnnOk = Boolean(cnn?.ok && cnn?.scores);
  let quality = await assessImageQuality(bytes, qualityThresholds ? { thresholds: qualityThresholds } : {});
  const faceSignal = cnnOk
    ? { detected: cnn.faceDetected === true, confidence: cnn.faceConfidence ?? undefined, count: cnn.faceDetected === true ? 1 : 0, note: "face area ratio not exposed by service" }
    : { detected: false, confidence: 0, count: 0, note: "CNN inference failed / no clear face" };
  quality = mergeFaceSignalIntoQuality(quality, faceSignal, qualityThresholds);
  qualityCache.set(key, quality);
  return quality;
}

// ---------- 重放 ----------
/**
 * @param {object} opts
 * @param {object} [opts.qualityThresholds]
 * @param {object} [opts.uncertaintyThresholds]
 * @param {object} [opts.riskPolicy]
 * @param {number} [opts.cnnWeight]
 * @param {boolean} [opts.dropDoubaoRefusal] 复现 Phase 3.1 离线脚本「丢弃拒判结果」的行为
 */
async function replay(opts = {}) {
  const records = [];
  for (const row of round1) {
    const cnn = cnnBy.get(row.image_id);
    const db = dbBy.get(row.image_id);
    const quality = await qualityFor(row, opts.qualityThresholds);
    const cnnOk = Boolean(cnn?.ok && cnn?.scores);
    const dbRefused = Boolean(db && db.ok === false && db.canJudgeReliably === false && db.scores);
    const dbUsable = Boolean(db?.ok && db?.scores);
    const useDb = dbUsable || (dbRefused && !opts.dropDoubaoRefusal);

    const doubaoInput = useDb ? {
      result: {
        season_scores: db.scores,
        most_likely_season: db.season,
        skin_undertone: db.features?.skin_undertone ?? "unknown",
        brightness: db.features?.brightness ?? "unknown",
        saturation: db.features?.saturation ?? "unknown",
        feature_contrast: db.features?.feature_contrast ?? "unknown",
        lighting_warning: db.lightingWarning === true,
        filter_warning: db.filterWarning === true,
        can_judge_reliably: db.canJudgeReliably === true,
        reason: "实验缓存重放：reason 未持久化，使用中性占位；不影响融合与状态决策。",
      },
    } : null;

    const result = buildAdvancedDiagnosis({
      cnn: cnnOk ? { season: cnn.season, scores: cnn.scores } : null,
      doubao: doubaoInput,
      cnnCode: cnnOk ? "OK" : "CNN_MISSING",
      doubaoCode: dbUsable ? "OK" : dbRefused ? "DOUBAO_UNRELIABLE" : db ? "DOUBAO_UNRELIABLE" : "DOUBAO_MISSING",
      cnnWeight: opts.cnnWeight ?? 0.4,
      imageQuality: quality,
      thresholds: opts.uncertaintyThresholds,
      riskPolicy: opts.riskPolicy,
    });

    const f = result.fusion;
    records.push({
      imageId: row.image_id,
      originalImageId: row.original_image_id,
      referenceSeason: row.reference_season,
      augmentationType: row.augmentation_type,
      cnnSplit: row.cnn_split,
      qualityLevel: quality.qualityLevel,
      cnnOk,
      cnnTop1: cnnOk ? cnn.season : "skipped",
      doubaoCalled: Boolean(db),
      doubaoUsable: dbUsable,
      doubaoRefused: dbRefused,
      doubaoTop1: dbUsable ? db.season : dbRefused ? "refused" : "skipped",
      topSeason: f?.predictedSeason ?? "none",
      topScore: f ? Number(f.seasonScores[f.predictedSeason].toFixed(4)) : null,
      topGap: f?.modelAgreement ? f.modelAgreement.fusedTopGap : (f ? Number((f.candidateSeasons[0].score - f.candidateSeasons[1].score).toFixed(4)) : null),
      tvd: f?.modelAgreement ? f.modelAgreement.totalVariationDistance : null,
      inferenceMode: result.inferenceMode,
      diagnosisStatus: result.diagnosisStatus,
      decisiveReasons: result.decisiveReasons,
      softWarnings: result.softWarnings,
      uncertaintyReasons: result.uncertaintyReasons,
      fusedScores: f?.seasonScores ?? null,
    });
  }
  return records;
}

// ---------- 指标 ----------
const SEVERE_TYPES = new Set(["blur_severe", "overexposed", "underexposed", "strong_filter"]);

function macroF1(pairs) {
  const f1 = {};
  for (const s of SEASONS) {
    const tp = pairs.filter(([p, t]) => p === s && t === s).length;
    const fp = pairs.filter(([p, t]) => p === s && t !== s).length;
    const fn = pairs.filter(([p, t]) => p !== s && t === s).length;
    f1[s] = tp ? (2 * tp) / (2 * tp + fp + fn) : 0;
  }
  return Number((SEASONS.reduce((a, s) => a + f1[s], 0) / 4).toFixed(4));
}

function summarize(records) {
  const total = records.length;
  const formal = records.filter((r) => r.diagnosisStatus === "CONFIDENT");
  const formalCorrect = formal.filter((r) => r.topSeason === r.referenceSeason);
  const originals = records.filter((r) => r.augmentationType === "original");
  const severe = records.filter((r) => SEVERE_TYPES.has(r.augmentationType));
  const dual = records.filter((r) => r.cnnOk && r.doubaoUsable);
  const pairs = dual.map((r) => [r.topSeason, r.referenceSeason]);
  const dualCorrect = pairs.filter(([p, t]) => p === t).length;
  return {
    n: total,
    statusCounts: {
      CONFIDENT: formal.length,
      UNCERTAIN: records.filter((r) => r.diagnosisStatus === "UNCERTAIN").length,
      RETAKE_REQUIRED: records.filter((r) => r.diagnosisStatus === "RETAKE_REQUIRED").length,
      DEGRADED: records.filter((r) => r.diagnosisStatus === "DEGRADED").length,
      FAILED: records.filter((r) => r.diagnosisStatus === "FAILED").length,
    },
    formalCount: formal.length,
    formalCoverage: ratio(formal.length, total),
    acceptedAccuracy: formal.length ? ratio(formalCorrect.length, formal.length) : null,
    acceptedAccuracyN: `${formalCorrect.length}/${formal.length}`,
    correctFormal: formalCorrect.length,
    wrongFormal: formal.length - formalCorrect.length,
    overallCorrectRate: ratio(formalCorrect.length, total),
    uncertainRate: ratio(records.filter((r) => r.diagnosisStatus === "UNCERTAIN").length, total),
    retakeRate: ratio(records.filter((r) => r.diagnosisStatus === "RETAKE_REQUIRED").length, total),
    degradedRate: ratio(records.filter((r) => r.diagnosisStatus === "DEGRADED").length, total),
    originalCoverage: ratio(originals.filter((r) => r.diagnosisStatus === "CONFIDENT").length, originals.length),
    originalFormalN: `${originals.filter((r) => r.diagnosisStatus === "CONFIDENT").length}/${originals.length}`,
    originalFalseReject: originals.filter((r) => r.diagnosisStatus === "RETAKE_REQUIRED").length,
    severeBlockRate: ratio(severe.filter((r) => r.diagnosisStatus !== "CONFIDENT").length, severe.length),
    severeBlockN: `${severe.filter((r) => r.diagnosisStatus !== "CONFIDENT").length}/${severe.length}`,
    dualSampleN: dual.length,
    pureAccuracy: dual.length ? ratio(dualCorrect, dual.length) : null,
    pureAccuracyN: `${dualCorrect}/${dual.length}`,
    pureMacroF1: macroF1(pairs),
  };
}

// ---------- 场景 A~F ----------
const legacy = { mode: "legacy" };
const layered = { mode: "layered", softWarningGroupsToEscalate: 2 };

const A = await replay({ riskPolicy: legacy });
const A0 = await replay({ riskPolicy: legacy, dropDoubaoRefusal: true });
const B = await replay({ riskPolicy: layered });
const BBy = new Map(B.map((r) => [r.imageId, r]));

// 与 Phase 3.1 记录逐行比对
const consistency = { total: A0.length, statusMatch: 0, statusMismatch: [], reasonMatch: 0, reasonMismatch: [] };
for (const rec of A0) {
  const old = phase31By.get(rec.imageId);
  if (!old) continue;
  if (old.diagnosisStatus === rec.diagnosisStatus) consistency.statusMatch += 1;
  else consistency.statusMismatch.push({ imageId: rec.imageId, phase31: old.diagnosisStatus, replay: rec.diagnosisStatus });
  const oldReasons = (old.uncertaintyReasons || "").split("|").filter(Boolean).join(",");
  const newReasons = rec.uncertaintyReasons.join(",");
  if (oldReasons === newReasons) consistency.reasonMatch += 1;
  else consistency.reasonMismatch.push({ imageId: rec.imageId, phase31: oldReasons, replay: newReasons });
}
const refusalRows = A.filter((r) => r.doubaoRefused);
const refusalDiff = refusalRows.map((r) => {
  const old = phase31By.get(r.imageId);
  const fixed = BBy.get(r.imageId);
  return {
    imageId: r.imageId,
    phase31Status: old?.diagnosisStatus,
    legacyReplayStatus: r.diagnosisStatus,
    fixedStatus: fixed?.diagnosisStatus,
    fixedInferenceMode: fixed?.inferenceMode,
    fixedReasons: fixed?.decisiveReasons.join("|"),
    fixedSoft: fixed?.softWarnings.join("|"),
  };
});


// 候选色偏阈值（离线实验用，不写入生产配置）
const COLOR_CAST_CANDIDATES = [0.11, 0.15, 0.18, 0.2, 0.25];
const C = await replay({ riskPolicy: layered, qualityThresholds: { channelCastWarning: 0.18, channelCastHigh: 0.25 } });// 候选不确定性阈值（代表性组合，来自单因素扫描）
const D = await replay({ riskPolicy: layered, qualityThresholds: { channelCastWarning: 0.18, channelCastHigh: 0.25 }, uncertaintyThresholds: { minTopScore: 0.4, minTopGap: 0.08, totalVariationDistance: 0.4, minModelTopGap: 0.08 } });
// 候选固定权重
const E = await replay({ riskPolicy: layered, qualityThresholds: { channelCastWarning: 0.18, channelCastHigh: 0.25 }, uncertaintyThresholds: { minTopScore: 0.4, minTopGap: 0.08, totalVariationDistance: 0.4, minModelTopGap: 0.08 }, cnnWeight: 0.5 });

const scenarios = {
  A_phase31_legacy: { desc: "Phase 3.1 原始规则与参数（legacy 策略）", records: A, summary: summarize(A) },
  B_layered_fix: { desc: "修复软警告分层与豆包拒判逻辑，保持原参数", records: B, summary: summarize(B) },
  C_colorcast: { desc: "B + 候选色偏阈值 (warning 0.18 / high 0.25)", records: C, summary: summarize(C) },
  D_uncertainty: { desc: "C + 候选不确定性阈值 (minTopScore 0.40 / minTopGap 0.08)", records: D, summary: summarize(D) },
  E_weight: { desc: "D + 候选固定权重 50:50", records: E, summary: summarize(E) },
};

// ---------- 严重颜色分布异常阈值扫描（图像侧决定性风险） ----------
const severeCastScan = [];
for (const value of [0.25, 0.3, 0.35, 0.4]) {
  const recs = await replay({ riskPolicy: layered, qualityThresholds: { channelCastSevere: value } });
  const s = summarize(recs);
  const strongDetected = recs.filter((r) => r.augmentationType === "strong_filter"
    && r.decisiveReasons.includes("SEVERE_COLOR_DISTORTION")).length;
  const strongTotal = recs.filter((r) => r.augmentationType === "strong_filter").length;
  const originalBlocked = recs.filter((r) => r.augmentationType === "original"
    && r.decisiveReasons.includes("SEVERE_COLOR_DISTORTION")).length;
  const originalTotal = recs.filter((r) => r.augmentationType === "original").length;
  severeCastScan.push({
    channelCastSevere: value,
    formalCount: s.formalCount,
    correctFormal: s.correctFormal,
    wrongFormal: s.wrongFormal,
    acceptedAccuracy: s.acceptedAccuracy,
    acceptedAccuracyN: s.acceptedAccuracyN,
    originalCoverage: s.originalCoverage,
    originalBlockedByColor: `${originalBlocked}/${originalTotal}`,
    strongFilterDetected: `${strongDetected}/${strongTotal}`,
    severeBlockN: s.severeBlockN,
  });
}

// ---------- 不确定性阈值单因素扫描（全部通过生产决策层重放，不另写规则） ----------
async function scanUncertainty(param, values) {
  const out = [];
  const base = { minTopScore: 0.5, minTopGap: 0.1, totalVariationDistance: 0.4, minModelTopGap: 0.08 };
  for (const value of values) {
    const recs = await replay({ riskPolicy: layered, uncertaintyThresholds: { ...base, [param]: value } });
    const s = summarize(recs);
    out.push({
      param, value,
      coverage: s.formalCoverage,
      acceptedAccuracy: s.acceptedAccuracy,
      acceptedAccuracyN: s.acceptedAccuracyN,
      wrongFormalRate: ratio(s.wrongFormal, s.n),
      uncertainRate: s.uncertainRate,
      retakeRate: s.retakeRate,
      degradedRate: s.degradedRate,
      overallCorrectRate: s.overallCorrectRate,
      originalCoverage: s.originalCoverage,
      severeBlockN: s.severeBlockN,
      n: s.n,
    });
  }
  return out;
}

const scan = {
  minTopScore: await scanUncertainty("minTopScore", [0.3, 0.35, 0.4, 0.45, 0.5]),
  minTopGap: await scanUncertainty("minTopGap", [0.05, 0.08, 0.1, 0.12, 0.15]),
  totalVariationDistance: await scanUncertainty("totalVariationDistance", [0.25, 0.3, 0.35, 0.4, 0.45, 0.5]),
  minModelTopGap: await scanUncertainty("minModelTopGap", [0.05, 0.08, 0.1, 0.12]),
};

// ---------- 固定权重对照（纯分类 + 综合诊断） ----------
const weightCandidates = [1, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.2, 0];
const common = B.filter((r) => r.cnnOk && r.doubaoUsable && r.fusedScores);
function pureScores(rec, cw) {
  // 从重放记录无法直接取回双模型原始分数，这里从缓存重新读取
  const cnn = cnnBy.get(rec.imageId);
  const db = dbBy.get(rec.imageId);
  const norm = (o) => {
    const vals = SEASONS.map((k) => o[k]);
    const sum = vals.reduce((a, b) => a + b, 0);
    return Object.fromEntries(SEASONS.map((k, i) => [k, vals[i] / sum]));
  };
  const c = norm(cnn.scores);
  const d = norm(db.scores);
  const blended = Object.fromEntries(SEASONS.map((k) => [k, cw * c[k] + (1 - cw) * d[k]]));
  return blended;
}
const weightRows = [];
for (const cw of weightCandidates) {
  const pairs = common.map((rec) => {
    const s = pureScores(rec, cw);
    const top = SEASONS.map((k) => [k, s[k]]).sort((a, b) => b[1] - a[1]);
    return [top[0][0], rec.referenceSeason];
  });
  const correct = pairs.filter(([p, t]) => p === t).length;
  // 综合诊断口径：同一权重下用修复后的生产决策层完整重放
  const recs = await replay({ riskPolicy: layered, cnnWeight: cw });
  const s = summarize(recs);
  weightRows.push({
    cnnWeight: cw,
    doubaoWeight: Number((1 - cw).toFixed(2)),
    pureAccuracy: ratio(correct, pairs.length),
    pureAccuracyN: `${correct}/${pairs.length}`,
    pureMacroF1: macroF1(pairs),
    diagnosisCoverage: s.formalCoverage,
    acceptedAccuracy: s.acceptedAccuracy,
    acceptedAccuracyN: s.acceptedAccuracyN,
    correctFormal: s.correctFormal,
    wrongFormal: s.wrongFormal,
    overallCorrectRate: s.overallCorrectRate,
    dualSampleN: pairs.length,
  });
}

// ---------- 色偏阈值离线分析（复用 768 张免费预检指标） ----------
function castAnalysis(threshold) {
  const byVariant = {};
  const bySeason = {};
  let originalWarn = 0, originalTotal = 0, strongFilterFlagged = 0, strongTotal = 0;
  let severeMissed = 0, severeTotal = 0;
  for (const row of qualityAll) {
    const cast = Number(row.channelCast);
    const high = 0.25;
    const flagged = cast >= threshold;
    const strong = cast >= high;
    const b = (byVariant[row.augmentation_type] ??= { n: 0, warn: 0, strong: 0 });
    b.n += 1; if (flagged) b.warn += 1; if (strong) b.strong += 1;
    const s = (bySeason[row.reference_season] ??= { n: 0, warn: 0 });
    s.n += 1; if (flagged) s.warn += 1;
    if (row.augmentation_type === "original") { originalTotal += 1; if (flagged) originalWarn += 1; }
    if (row.augmentation_type === "strong_filter") { strongTotal += 1; if (strong) strongFilterFlagged += 1; }
    if (SEVERE_TYPES.has(row.augmentation_type)) {
      severeTotal += 1;
      if (row.qualityLevel !== "REJECT") severeMissed += 1;
    }
  }
  return {
    threshold,
    originalWarnRate: ratio(originalWarn, originalTotal),
    originalWarnN: `${originalWarn}/${originalTotal}`,
    strongFilterHighRate: ratio(strongFilterFlagged, strongTotal),
    byVariant: Object.fromEntries(Object.entries(byVariant).map(([k, v]) => [k, { n: v.n, warnRate: ratio(v.warn, v.n), warnN: `${v.warn}/${v.n}`, strongRate: ratio(v.strong, v.n) }])),
    bySeason: Object.fromEntries(Object.entries(bySeason).map(([k, v]) => [k, { n: v.n, warnRate: ratio(v.warn, v.n), warnN: `${v.warn}/${v.n}` }])),
    severeNotRejected: severeMissed,
    severeTotal,
  };
}
const castStudy = COLOR_CAST_CANDIDATES.map((t) => castAnalysis(t));

// ---------- 数据集划分修正（§10） ----------
// 1) 核对抽样原图与 CNN 原始划分表的对应关系；
// 2) 把训练集/验证集重叠样本标记为「非独立评估数据」；
// 3) 锁定唯一可用于最终评估的 CNN test 原图及其全部同源变体。
const originalRows = manifest.filter((r) => r.augmentation_type === "original");
const bySplitOf = (split) => originalRows.filter((r) => r.cnn_split === split).map((r) => r.original_image_id);
const lockedOriginals = bySplitOf("test");
const lockedImages = manifest.filter((r) => lockedOriginals.includes(r.original_image_id)).map((r) => r.image_id);
const round1Originals = manifest.filter((r) => r.dataset_split === "round1_and_calibration" && r.augmentation_type === "original")
  .map((r) => ({ original: r.original_image_id, cnnSplit: r.cnn_split }));
// validation 集合中并非 CNN test 的原图 → 重新标记为开发样本
const relabeled = manifest.filter((r) => r.augmentation_type === "original"
  && r.dataset_split === "validation" && r.cnn_split !== "test")
  .map((r) => ({ original: r.original_image_id, cnnSplit: r.cnn_split }));

const datasetSummary = {
  seed: 42,
  sampledOriginals: originalRows.length,
  sampledImages: manifest.length,
  byCnnSplit: {
    train: bySplitOf("train").length,
    val: bySplitOf("val").length,
    test: bySplitOf("test").length,
  },
  round1Originals,
  round1IndependentImages: round1Originals.filter((r) => r.cnnSplit === "test").length,
  lockedIndependentEvaluation: {
    originals: lockedOriginals.length,
    imagesIncludingVariants: lockedImages.length,
    usedInRound1: lockedImages.filter((id) => round1.some((r) => r.image_id === id)).length,
    rule: "CNN 从未参与训练与模型选择的原测试集图片，及其全部同源变体；本轮不得用于参数探索。",
  },
  relabeledToDevelopment: relabeled,
  note: "训练集/验证集重叠样本只能用于机制测试与开发期参数探索；独立验证只允许使用锁定的 CNN test 样本。第一轮 8 张原图全部来自 train/val，未污染锁定集。",
};

// 写回划分信息（幂等）：在 dataset_split.json 追加修正块，并把非独立样本从 validation 移出。
const splitFile = path.join(EXP, "dataset_split.json");
if (existsSync(splitFile)) {
  const splitDoc = JSON.parse(readFileSync(splitFile, "utf-8"));
  splitDoc.phase3_2_correction = datasetSummary;
  writeFileSync(splitFile, JSON.stringify(splitDoc, null, 2), "utf-8");
}
if (relabeled.length > 0) {
  const relabelSet = new Set(relabeled.map((r) => r.original));
  const header = manifest[0] ? Object.keys(manifest[0]) : [];
  const lines = [header.join(",")];
  for (const row of manifest) {
    if (relabelSet.has(row.original_image_id) && row.dataset_split === "validation") {
      row.dataset_split = "calibration";
    }
    lines.push(header.map((k) => {
      const v = String(row[k] ?? "");
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(","));
  }
  writeFileSync(path.join(EXP, "sample_manifest.csv"), lines.join("\n"), "utf-8");
}

// ---------- 典型错误案例 ----------
function caseRows(records, filterFn, limit) {
  return records.filter(filterFn).slice(0, limit).map((r) => ({
    imageId: r.imageId, referenceSeason: r.referenceSeason, augmentationType: r.augmentationType,
    cnnTop1: r.cnnTop1, doubaoTop1: r.doubaoTop1, topSeason: r.topSeason, topScore: r.topScore, topGap: r.topGap,
    tvd: r.tvd, status: r.diagnosisStatus, decisive: r.decisiveReasons.join("|"), soft: r.softWarnings.join("|"),
  }));
}

// ---------- 锁定独立评估集（零付费调用，仅用已有 CNN 缓存 + 本地质量计算） ----------
// 独立集 = CNN test 原图及其全部同源变体（manifest 中 dataset_split === "validation"）。
// 豆包在该集合上没有缓存，因此**无法**在零付费前提下做双模型独立验证；
// 本节只验证「不依赖豆包」的机制：本地质量门控、严重色偏阈值、CNN 单模型独立表现。
const lockedRows = manifest.filter((r) => r.dataset_split === "validation" && r.cnn_split === "test");
const lockedOriginalIds = [...new Set(lockedRows.map((r) => r.original_image_id))];
const lockedQuality = [];
for (const row of lockedRows) {
  const q = await qualityFor(row);                       // 本地像素计算，无 API 调用
  const cnn = cnnBy.get(row.image_id);
  const scores = cnn?.ok && cnn?.scores ? cnn.scores : null;
  const sorted = scores ? SEASONS.map((s) => ({ s, v: Number(scores[s] ?? 0) })).sort((a, b) => b.v - a.v) : [];
  lockedQuality.push({
    imageId: row.image_id,
    original: row.original_image_id,
    referenceSeason: row.reference_season,
    augmentationType: row.augmentation_type,
    qualityLevel: q.qualityLevel,
    channelCast: Number(q.metrics?.channelCast?.value ?? 0),
    cnnTop1: cnn?.ok ? cnn.top1 : null,
    cnnConfidence: cnn?.ok ? Number(cnn.confidence ?? 0) : null,
    cnnTopScore: sorted[0]?.v ?? null,
    cnnTopGap: sorted.length >= 2 ? Number((sorted[0].v - sorted[1].v).toFixed(6)) : null,
  });
}
const lockedLevelCounts = lockedQuality.reduce((acc, r) => {
  acc[r.qualityLevel] = (acc[r.qualityLevel] ?? 0) + 1; return acc;
}, {});
const lockedSevere = lockedQuality.filter((r) => SEVERE_TYPES.has(r.augmentationType));
const lockedSevereBlocked = lockedSevere.filter((r) => r.qualityLevel === "REJECT" || r.qualityLevel === "WARNING");
const lockedOriginalsRows = lockedQuality.filter((r) => r.augmentationType === "original");
const lockedStrongFilter = lockedQuality.filter((r) => r.augmentationType === "strong_filter");
const lockedCnnCorrect = lockedOriginalsRows.filter((r) => r.cnnTop1 === r.referenceSeason).length;
const lockedCnnEligible = lockedOriginalsRows.filter((r) => (r.cnnTopScore ?? 0) >= 0.5 && (r.cnnTopGap ?? 0) >= 0.1).length;
const lockedIndependentCheck = {
  definition: "manifest 中 dataset_split === 'validation' 且 cnn_split === 'test' 的样本；即 CNN 从未参与训练与模型选择的原测试集图片及其全部同源变体。",
  images: lockedQuality.length,
  originals: lockedOriginalIds.length,
  paidApiCalls: 0,
  doubaoCacheAvailable: lockedRows.filter((r) => dbBy.has(r.image_id)).length,
  note: "豆包在该独立集上没有缓存，双模型独立验证需要约 198 次付费调用，已按零付费约束推迟到下一轮（见 docs/phase3.2-report.md §10.3 P0）。本节只验证不依赖豆包的机制。",
  qualityGate: {
    levelCounts: lockedLevelCounts,
    severeImages: lockedSevere.length,
    severeNotPassed: lockedSevere.length - lockedSevereBlocked.length,
    severeBlockedN: `${lockedSevereBlocked.length}/${lockedSevere.length}`,
    severeBlockedRate: ratio(lockedSevereBlocked.length, lockedSevere.length),
    note: "严重变体（blur_severe/overexposed/underexposed/strong_filter）未被质量门控判为 REJECT/WARNING 的数量。",
  },
  severeColorGate: {
    threshold: 0.3,
    lockedOriginalsFlagged: lockedOriginalsRows.filter((r) => r.channelCast >= 0.3).length,
    lockedOriginalsN: lockedOriginalsRows.length,
    lockedStrongFilterFlagged: lockedStrongFilter.filter((r) => r.channelCast >= 0.3).length,
    lockedStrongFilterN: lockedStrongFilter.length,
  },
  cnnOnlyOnLockedOriginals: {
    n: lockedOriginalsRows.length,
    top1Correct: lockedCnnCorrect,
    top1Accuracy: ratio(lockedCnnCorrect, lockedOriginalsRows.length),
    eligibleForFormal: lockedCnnEligible,
    eligibleRatio: ratio(lockedCnnEligible, lockedOriginalsRows.length),
    note: "CNN 单模型在从未参与训练的 test 原图上的 Top-1 准确率，以及同时满足 minTopScore>=0.5 且 minTopGap>=0.1 的比例（单模型能进入正式输出的上限）。",
  },
  perOriginal: lockedOriginalsRows.map((r) => ({
    original: r.original, referenceSeason: r.referenceSeason, cnnTop1: r.cnnTop1,
    cnnTopScore: r.cnnTopScore, cnnTopGap: r.cnnTopGap, channelCast: r.channelCast, qualityLevel: r.qualityLevel,
  })),
};
const errorCases = {
  bothWrongAgree: caseRows(B, (r) => r.diagnosisStatus === "CONFIDENT" && r.topSeason !== r.referenceSeason
    && r.cnnTop1 !== "skipped" && r.doubaoTop1 !== "skipped" && r.cnnTop1 !== r.referenceSeason && r.doubaoTop1 !== r.referenceSeason, 6),
  bothRightUncertain: caseRows(B, (r) => r.diagnosisStatus === "UNCERTAIN"
    && r.cnnTop1 === r.referenceSeason && r.doubaoTop1 === r.referenceSeason, 8),
  refused: caseRows(B, (r) => r.doubaoRefused, 8),
  severeStillConfident: caseRows(B, (r) => SEVERE_TYPES.has(r.augmentationType) && r.diagnosisStatus === "CONFIDENT", 6),
};

// ---------- 输出 ----------
const output = {
  generatedBy: "experiments/phase3.1/scripts/phase3.2-analysis.mjs",
  paidApiCalls: 0,
  consistency: {
    ...consistency,
    phase31ReplayStatusMatch: consistency.statusMatch,
    note: "A0 = legacy 策略且丢弃豆包拒判结果，与 Phase 3.1 离线脚本一致；A = legacy 策略且保留拒判结果（生产口径）。",
  },
  refusalRows: { count: refusalRows.length, diff: refusalDiff },
  scenarios: Object.fromEntries(Object.entries(scenarios).map(([k, v]) => [k, { desc: v.desc, summary: v.summary }])),
  scenarioRecords: Object.fromEntries(Object.entries(scenarios).map(([k, v]) => [k, v.records.map((r) => ({ imageId: r.imageId, status: r.diagnosisStatus, decisive: r.decisiveReasons.join("|"), soft: r.softWarnings.join("|"), top: r.topSeason, ref: r.referenceSeason }))])),
  uncertaintyScan: scan,
  severeCastScan,
  weightComparison: weightRows,
  colorCastStudy: castStudy,
  datasetSummary,
  lockedIndependentCheck,
  errorCases,
};

writeFileSync(R("phase3.2_analysis.json"), JSON.stringify(output, null, 2), "utf-8");

// ---------- stdout 摘要 ----------
console.log(JSON.stringify({
  consistency: { statusMatch: consistency.statusMatch, statusMismatch: consistency.statusMismatch.length, reasonMatch: consistency.reasonMatch, reasonMismatch: consistency.reasonMismatch.length },
  refusalRows: refusalRows.length,
  summaries: Object.fromEntries(Object.entries(scenarios).map(([k, v]) => [k, v.summary])),
  weightComparison: weightRows,
  uncertaintyScan: scan,
  severeCastScan,
  colorCastStudy: castStudy.map((c) => ({ threshold: c.threshold, originalWarnN: c.originalWarnN, strongFilterHighRate: c.strongFilterHighRate })),
  datasetSummary,
  lockedIndependentCheck: {
    images: lockedIndependentCheck.images,
    originals: lockedIndependentCheck.originals,
    doubaoCacheAvailable: lockedIndependentCheck.doubaoCacheAvailable,
    qualityGate: lockedIndependentCheck.qualityGate,
    severeColorGate: lockedIndependentCheck.severeColorGate,
    cnnOnlyOnLockedOriginals: lockedIndependentCheck.cnnOnlyOnLockedOriginals,
  },
}, null, 2));
