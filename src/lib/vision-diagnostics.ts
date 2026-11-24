/**
 * 脱敏诊断日志（默认关闭）。
 *
 * 用途：定位 Doubao 视觉拒判与融合降级问题，只在 VISION_DIAGNOSTICS_LOG_ENABLED=true 时输出。
 * 安全约束：
 * - 只允许白名单键；未知键一律丢弃，避免误把 Prompt / 响应原文 / 密钥传进日志。
 * - 字符串值限制长度并拒绝换行；reason、Base64、图片数据、用户画像不在白名单内。
 * - 不写入 Firestore，不改变数据库 Schema。
 */

export const VISION_DIAGNOSTICS_EVENTS = [
  "vision.image",
  "vision.result",
  "vision.failure",
  "fusion.result",
] as const;

export type VisionDiagnosticsEvent = (typeof VISION_DIAGNOSTICS_EVENTS)[number];

/** 经审查允许进入日志的机器可读字段。 */
const ALLOWED_KEYS = new Set<string>([
  // 图片元数据（无像素内容）
  "mimeType",
  "inputWidth",
  "inputHeight",
  "width",
  "height",
  "originalBytes",
  "sentBytes",
  "orientation",
  "orientationApplied",
  "metadataStripped",
  // Doubao 调用元数据
  "modelId",
  "durationMs",
  "attempts",
  "responseFormat",
  "httpStatus",
  "finishReason",
  "contentLength",
  "requestId",
  "promptTokens",
  "completionTokens",
  "reasoningTokens",
  "totalTokens",
  "usageSource",
  // 可靠性判断（布尔，不是自然语言 reason）
  "canJudgeReliably",
  "lightingWarning",
  "filterWarning",
  // 融合结果（枚举与机器码）
  "fusionEnabled",
  "cnnWeight",
  "source",
  "fallbackReason",
  "code",
  "status",
]);

const MAX_STRING_LENGTH = 80;

export function isVisionDiagnosticsLogEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env.VISION_DIAGNOSTICS_LOG_ENABLED ?? "false").trim().toLowerCase() === "true";
}

/** 只保留有限数字、布尔、短字符串与 null；其余值不进入日志。 */
function sanitizeFields(fields: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value === "boolean" || value === null) {
      safe[key] = value;
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) safe[key] = value;
    } else if (typeof value === "string") {
      if (value.length <= MAX_STRING_LENGTH && !/[\r\n\t]/.test(value)) safe[key] = value;
    }
  }
  return safe;
}

/** 关闭时是空操作；开启时只输出白名单内的安全元数据。 */
export function logVisionDiagnostics(
  event: VisionDiagnosticsEvent,
  fields: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): void {
  if (!isVisionDiagnosticsLogEnabled(env)) return;
  console.info(`[vision-diagnostics] ${event}`, sanitizeFields(fields));
}
