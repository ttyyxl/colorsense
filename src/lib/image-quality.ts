import sharp from "sharp";
import {
  IMAGE_QUALITY_THRESHOLDS as T,
  THRESHOLD_CALIBRATION_NOTE,
} from "./diagnosis-config.ts";
import type { ImageQualityThresholds } from "./diagnosis-config.ts";
import type {
  ImageQualityAssessment,
  ImageQualityIssue,
  ImageQualityMetric,
  ImageQualityLevel,
} from "./diagnosis-types.ts";

/**
 * 本地轻量图像质量评估（Node 层，sharp）。
 *
 * 设计边界：
 * - 只使用像素统计做可解释的轻量检测，不宣称滤镜/美颜识别准确率。
 * - 人脸信号来自现有 FastAPI 的 MediaPipe 检测；本模块不重复实现人脸检测。
 * - 无法可靠判断的维度返回 "unknown"，不默认视为通过。
 * - 中心 40% 区域作为人脸/肤色近似区，相关指标标注 approximate=true。
 * - 所有阈值集中在 diagnosis-config.ts，尚未经独立验证集校准。
 */

export interface FaceSignal {
  /** FastAPI 是否确认检测到清晰人脸。 */
  detected?: boolean;
  /** MediaPipe 人脸置信度。 */
  confidence?: number;
  /** 检测到的人脸数量；多人脸在现有服务中会走 422，这里仅作记录。 */
  count?: number;
  /** 人脸框面积占整图比例（如服务提供）。 */
  areaRatio?: number;
}

export interface AssessImageQualityOptions {
  face?: FaceSignal;
  /** 覆盖本地解码（测试可注入已解码像素）。 */
  decoded?: DecodedPixels;
  /**
   * 覆盖图像质量阈值；仅用于离线实验对照，生产默认取 IMAGE_QUALITY_THRESHOLDS。
   * 传入覆盖值不会改变任何持久化配置。
   */
  thresholds?: Partial<ImageQualityThresholds>;
}

export interface DecodedPixels {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
  /** 本地是否成功解码（false 时所有像素指标为 unknown）。 */
  decoded: boolean;
  sourceWidth?: number;
  sourceHeight?: number;
}

function metric(value: number | "unknown", approximate = false, note?: string): ImageQualityMetric {
  return { value, ...(approximate ? { approximate: true } : {}), ...(note ? { note } : {}) };
}

const unknownMetric = (note?: string): ImageQualityMetric => metric("unknown", false, note);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 灰度化（BT.601 亮度权重），供拉普拉斯方差与截断比例使用。 */
function toLuma(data: Uint8Array, channels: number): Float64Array {
  const pixelCount = Math.floor(data.length / channels);
  const luma = new Float64Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * channels;
    const r = data[offset] ?? 0;
    const g = channels >= 3 ? data[offset + 1] ?? 0 : r;
    const b = channels >= 3 ? data[offset + 2] ?? 0 : r;
    luma[index] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luma;
}

/**
 * 拉普拉斯方差：3x3 卷积 [0,1,0;1,-4,1;0,1,0] 后取方差。
 * 值越低表示图像越模糊；仅作为清晰度参考，不是通用锐度真值。
 */
export function computeLaplacianVariance(data: Uint8Array, width: number, height: number, channels: number): number {
  if (width < 3 || height < 3 || channels < 1) return 0;
  const luma = toLuma(data, channels);
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const lap =
        luma[index - width] + luma[index + width] + luma[index - 1] + luma[index + 1] - 4 * luma[index];
      sum += lap;
      sumSquares += lap * lap;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, sumSquares / count - mean * mean);
}

interface CenterStats {
  clippedBrightRatio: number;
  clippedDarkRatio: number;
  meanLuma: number;
}

/** 中心区域（人脸近似区）的曝光与截断统计。 */
function computeCenterStats(
  luma: Float64Array,
  width: number,
  height: number,
  thresholds: ImageQualityThresholds,
): CenterStats {
  const halfW = Math.max(1, Math.floor((width * thresholds.centerRegionRatio) / 2));
  const halfH = Math.max(1, Math.floor((height * thresholds.centerRegionRatio) / 2));
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const x1 = Math.max(0, cx - halfW);
  const x2 = Math.min(width, cx + halfW);
  const y1 = Math.max(0, cy - halfH);
  const y2 = Math.min(height, cy + halfH);

  let bright = 0;
  let dark = 0;
  let lumaSum = 0;
  let count = 0;
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      const value = luma[y * width + x];
      if (value >= thresholds.brightClipLevel) bright += 1;
      if (value <= thresholds.darkClipLevel) dark += 1;
      lumaSum += value;
      count += 1;
    }
  }
  if (count === 0) return { clippedBrightRatio: 0, clippedDarkRatio: 0, meanLuma: 0 };
  return {
    clippedBrightRatio: bright / count,
    clippedDarkRatio: dark / count,
    meanLuma: lumaSum / count,
  };
}

/** 整图 RGB 通道均值与最大通道差（归一化 0-1）。 */
function computeChannelCast(data: Uint8Array, channels: number, pixelCount: number): number {
  if (channels < 3 || pixelCount === 0) return 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * channels;
    r += data[offset] ?? 0;
    g += data[offset + 1] ?? 0;
    b += data[offset + 2] ?? 0;
  }
  const means = [r / pixelCount, g / pixelCount, b / pixelCount];
  return (Math.max(...means) - Math.min(...means)) / 255;
}

/**
 * 将服务端人脸门控结果合并进已完成的像素质量评估。
 * 不重新解码图片，也不伪造未知指标（如人脸框占比）。
 */
export function mergeFaceSignalIntoQuality(
  base: ImageQualityAssessment,
  face: FaceSignal & { note?: string },
  thresholds?: Partial<ImageQualityThresholds>,
): ImageQualityAssessment {
  const t: ImageQualityThresholds = { ...T, ...thresholds };
  const issues = [...base.issues];
  const recommendation = [...base.recommendation];
  const metrics = { ...base.metrics };
  let hasCritical = issues.some((issue) => issue.severity === "critical");
  const hasWarning = issues.some((issue) => issue.severity === "warning");

  if (typeof face.detected === "boolean") {
    metrics.faceDetected = metric(face.detected ? 1 : 0);
    if (!face.detected && !issues.some((issue) => issue.code === "NO_CLEAR_FACE")) {
      pushIssue(issues, recommendation, "NO_CLEAR_FACE", "critical", "未检测到清晰人脸，请上传清晰、正对镜头的真人正脸照片。");
      hasCritical = true;
    }
  }
  if (typeof face.count === "number" && Number.isFinite(face.count)) {
    metrics.faceCount = metric(face.count);
    if (face.count > 1 && !issues.some((issue) => issue.code === "MULTIPLE_FACES")) {
      pushIssue(issues, recommendation, "MULTIPLE_FACES", "critical", "检测到多张人脸，请上传仅包含本人面部的照片。");
      hasCritical = true;
    }
  }
  if (typeof face.confidence === "number" && Number.isFinite(face.confidence)) {
    metrics.faceConfidence = metric(round(face.confidence));
    if (face.confidence < t.minFaceConfidence && !issues.some((issue) => issue.code === "LOW_FACE_CONFIDENCE")) {
      pushIssue(issues, recommendation, "LOW_FACE_CONFIDENCE", "critical", "人脸不够清晰，请上传清晰、正对镜头的真人正脸照片。");
      hasCritical = true;
    }
  }
  if (face.note) {
    metrics.faceAreaRatio = unknownMetric(face.note);
  }

  const qualityLevel: ImageQualityLevel = hasCritical ? "REJECT" : hasWarning ? "WARNING" : "PASS";
  const severity: ImageQualityAssessment["severity"] = hasCritical
    ? "high"
    : hasWarning
      ? "medium"
      : issues.length > 0 ? "low" : "none";
  return {
    ...base,
    qualityLevel,
    severity,
    metrics,
    issues,
    recommendation,
    overallQuality: round(clamp01(1 - issues.filter((issue) => issue.severity === "critical").length * 0.35
      - issues.filter((issue) => issue.severity === "warning").length * 0.12
      - issues.filter((issue) => issue.severity === "info").length * 0.03)),
  };
}

async function decodeImage(bytes: Uint8Array, thresholds: ImageQualityThresholds): Promise<DecodedPixels> {
  try {
    const source = await sharp(Buffer.from(bytes)).metadata();
    const width = source.width ?? 0;
    const height = source.height ?? 0;
    if (width < 1 || height < 1) {
      return { width: 0, height: 0, channels: 0, data: new Uint8Array(), decoded: false };
    }
    const { data, info } = await sharp(Buffer.from(bytes))
      .resize(thresholds.analysisDimension, thresholds.analysisDimension, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return {
      width: info.width,
      height: info.height,
      channels: info.channels,
      data: new Uint8Array(data),
      decoded: true,
      sourceWidth: width,
      sourceHeight: height,
    };
  } catch {
    // 不把解码库错误原文暴露给用户或日志；无法解码时明确返回 unknown。
    return { width: 0, height: 0, channels: 0, data: new Uint8Array(), decoded: false };
  }
}

function pushIssue(
  issues: ImageQualityIssue[],
  recommendation: string[],
  code: string,
  severity: ImageQualityIssue["severity"],
  message: string,
): void {
  issues.push({ code, severity, message });
  if (!recommendation.includes(message)) recommendation.push(message);
}

/**
 * 评估图像质量。严重过曝、严重欠曝、严重模糊、分辨率不足、明确无人脸/多人脸 → REJECT。
 * 疑似滤镜/色偏只给风险提示，不直接拒绝正常图片。
 */
export async function assessImageQuality(
  imageBytes: Uint8Array,
  options: AssessImageQualityOptions = {},
): Promise<ImageQualityAssessment> {
  const t: ImageQualityThresholds = { ...T, ...options.thresholds };
  const decoded = options.decoded ?? (await decodeImage(imageBytes, t));
  const issues: ImageQualityIssue[] = [];
  const recommendation: string[] = [];
  const face = options.face ?? {};

  const sourceWidth = decoded.sourceWidth ?? decoded.width;
  const sourceHeight = decoded.sourceHeight ?? decoded.height;
  const widthMetric = sourceWidth > 0 ? metric(sourceWidth) : unknownMetric("无法读取图片宽度");
  const heightMetric = sourceHeight > 0 ? metric(sourceHeight) : unknownMetric("无法读取图片高度");
  const meetsModelInput =
    sourceWidth > 0 && sourceHeight > 0
      ? metric(sourceWidth >= t.minDimension && sourceHeight >= t.minDimension ? 1 : 0)
      : unknownMetric("无法判断分辨率是否满足模型输入");

  if (!decoded.decoded) {
    pushIssue(
      issues,
      recommendation,
      "LOCAL_PRECHECK_UNAVAILABLE",
      "warning",
      "无法在本地完成图像质量检测，请上传 JPG 或 PNG 格式的照片后重试。",
    );
  }

  let laplacianVariance: number | "unknown" = "unknown";
  let clippedBrightRatio: number | "unknown" = "unknown";
  let clippedDarkRatio: number | "unknown" = "unknown";
  let channelCast: number | "unknown" = "unknown";

  if (decoded.decoded && decoded.data.length > 0) {
    const pixelCount = Math.floor(decoded.data.length / decoded.channels);
    const luma = toLuma(decoded.data, decoded.channels);
    const center = computeCenterStats(luma, decoded.width, decoded.height, t);
    laplacianVariance = round(computeLaplacianVariance(decoded.data, decoded.width, decoded.height, decoded.channels), 2);
    clippedBrightRatio = round(center.clippedBrightRatio);
    clippedDarkRatio = round(center.clippedDarkRatio);
    channelCast = round(computeChannelCast(decoded.data, decoded.channels, pixelCount));
  }

  // 分辨率：明确不足 → REJECT。
  if (meetsModelInput.value === 0) {
    pushIssue(
      issues,
      recommendation,
      "RESOLUTION_TOO_LOW",
      "critical",
      `照片分辨率过低（最小 ${t.minDimension}×${t.minDimension}），请上传更高清的照片。`,
    );
  } else if (meetsModelInput.value === "unknown") {
    pushIssue(issues, recommendation, "RESOLUTION_UNKNOWN", "info", "无法读取图片尺寸，将由服务端进一步校验。");
  }

  // 人脸信号：来自现有 FastAPI；无信号时标记 unknown，不默认通过。
  const faceDetectedMetric =
    typeof face.detected === "boolean" ? metric(face.detected ? 1 : 0) : unknownMetric("未获得人脸检测结果");
  const faceConfidenceMetric =
    typeof face.confidence === "number" && Number.isFinite(face.confidence)
      ? metric(round(face.confidence))
      : unknownMetric("未获得人脸置信度");
  const faceCountMetric =
    typeof face.count === "number" && Number.isFinite(face.count)
      ? metric(face.count)
      : unknownMetric("未获得人脸数量");
  const faceAreaRatioMetric =
    typeof face.areaRatio === "number" && Number.isFinite(face.areaRatio)
      ? metric(round(face.areaRatio))
      : unknownMetric("未获得人脸框占比");

  if (faceDetectedMetric.value === 0) {
    pushIssue(
      issues,
      recommendation,
      "NO_CLEAR_FACE",
      "critical",
      "未检测到清晰人脸，请上传清晰、正对镜头的真人正脸照片。",
    );
  }
  if (faceCountMetric.value !== "unknown" && faceCountMetric.value > 1) {
    pushIssue(
      issues,
      recommendation,
      "MULTIPLE_FACES",
      "critical",
      "检测到多张人脸，请上传仅包含本人面部的照片。",
    );
  }
  if (typeof face.confidence === "number" && Number.isFinite(face.confidence) && face.confidence < t.minFaceConfidence) {
    pushIssue(
      issues,
      recommendation,
      "LOW_FACE_CONFIDENCE",
      "critical",
      "人脸不够清晰，请上传清晰、正对镜头的真人正脸照片。",
    );
  }
  if (typeof face.areaRatio === "number" && Number.isFinite(face.areaRatio) && face.areaRatio < t.minFaceAreaRatio) {
    pushIssue(
      issues,
      recommendation,
      "FACE_TOO_SMALL",
      "warning",
      "面部在画面中占比过小，请靠近一些重新拍摄。",
    );
  }

  // 过曝 / 欠曝：中心区域（人脸近似区）截断比例。
  if (clippedBrightRatio !== "unknown") {
    if (clippedBrightRatio >= t.clippedBrightReject) {
      pushIssue(
        issues,
        recommendation,
        "OVEREXPOSED",
        "critical",
        "照片曝光过度，请在自然光环境下重新拍摄。",
      );
    } else if (clippedBrightRatio >= t.clippedBrightWarning) {
      pushIssue(
        issues,
        recommendation,
        "POSSIBLE_OVEREXPOSURE",
        "warning",
        "照片局部可能过曝，请在自然光下拍摄，避免强光直射面部。",
      );
    }
  }
  if (clippedDarkRatio !== "unknown") {
    if (clippedDarkRatio >= t.clippedDarkReject) {
      pushIssue(
        issues,
        recommendation,
        "UNDEREXPOSED",
        "critical",
        "照片光线过暗，请在均匀自然光下重新拍摄。",
      );
    } else if (clippedDarkRatio >= t.clippedDarkWarning) {
      pushIssue(
        issues,
        recommendation,
        "POSSIBLE_UNDEREXPOSURE",
        "warning",
        "当前照片存在明显阴影，请保证面部光线均匀。",
      );
    }
  }

  // 清晰度：拉普拉斯方差。
  if (laplacianVariance !== "unknown") {
    if (laplacianVariance < t.laplacianVarianceReject) {
      pushIssue(
        issues,
        recommendation,
        "SEVERE_BLUR",
        "critical",
        "照片清晰度不足，请上传清晰的正面人像。",
      );
    } else if (laplacianVariance < t.laplacianVarianceWarning) {
      pushIssue(
        issues,
        recommendation,
        "POSSIBLE_BLUR",
        "warning",
        "照片可能略有模糊，建议使用清晰对焦的正面照片。",
      );
    }
  }

  // 颜色分布异常 / 疑似色彩处理：只做风险提示。
  // 说明：该指标同时受正常肤色、冷暖光照、背景颜色与饱和度影响，
  // 因此它是「颜色分布异常风险」而不是可靠的滤镜识别结果，也绝不据此拒绝诊断。
  if (channelCast !== "unknown") {
    if (channelCast >= t.channelCastSevere) {
      pushIssue(
        issues,
        recommendation,
        "SEVERE_COLOR_DISTORTION",
        "warning",
        "画面颜色分布明显失衡，季型判断所依赖的颜色信息可靠性不足，本次不输出正式季型。",
      );
    }
    if (channelCast >= t.channelCastHigh) {
      pushIssue(
        issues,
        recommendation,
        "SUSPECTED_COLOR_PROCESSING",
        "warning",
        "画面颜色偏向单一通道，可能存在较强色彩处理或特殊光色；如使用了滤镜，建议关闭后重新拍摄。",
      );
    } else if (channelCast >= t.channelCastWarning) {
      pushIssue(
        issues,
        recommendation,
        "POSSIBLE_COLOR_CAST",
        "info",
        "画面可能存在轻微色偏；如使用了滤镜，建议关闭后重新拍摄。",
      );
    }
  }

  const hasCritical = issues.some((issue) => issue.severity === "critical");
  const hasWarning = issues.some((issue) => issue.severity === "warning");
  const qualityLevel: ImageQualityLevel = hasCritical
    ? "REJECT"
    : hasWarning
      ? "WARNING"
      : "PASS";

  // 评分：从 1 起按问题严重度扣分，clamp 到 [0,1]；不是诊断正确率。
  let score = 1;
  for (const issue of issues) {
    if (issue.severity === "critical") score -= 0.35;
    else if (issue.severity === "warning") score -= 0.12;
    else score -= 0.03;
  }
  const overallQuality = round(clamp01(score));

  const severity: ImageQualityAssessment["severity"] = hasCritical
    ? "high"
    : hasWarning
      ? "medium"
      : issues.length > 0
        ? "low"
        : "none";

  return {
    overallQuality,
    qualityLevel,
    metrics: {
      width: widthMetric,
      height: heightMetric,
      meetsModelInput,
      faceDetected: faceDetectedMetric,
      faceCount: faceCountMetric,
      faceConfidence: faceConfidenceMetric,
      faceAreaRatio: faceAreaRatioMetric,
      laplacianVariance: metric(laplacianVariance, true, "基于缩放后的灰度图计算，仅作清晰度参考"),
      clippedBrightRatio: metric(clippedBrightRatio, true, "基于中心 40% 区域近似人脸曝光"),
      clippedDarkRatio: metric(clippedDarkRatio, true, "基于中心 40% 区域近似人脸阴影"),
      channelCast: metric(channelCast, true, "整图通道均值差，正常肤色与暖/冷光照也会影响该值"),
      // 单张图片无法可靠识别滤镜/美颜/妆容，也不做遮挡的确定性判断。
      suspectedFilter: unknownMetric("单张图片无法可靠识别滤镜、美颜或妆容，仅提供色彩处理风险提示"),
      occlusion: unknownMetric("未获得面部关键点遮挡信息"),
    },
    issues,
    severity,
    recommendation: recommendation.length > 0
      ? recommendation
      : ["照片质量检测未发现明显问题。"],
    calibrationNote: THRESHOLD_CALIBRATION_NOTE,
  };
}
