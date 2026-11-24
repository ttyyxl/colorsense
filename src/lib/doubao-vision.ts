import OpenAI from "openai";
import sharp from "sharp";
import {
  DOUBAO_VISION_SYSTEM_PROMPT,
  DOUBAO_VISION_USER_INSTRUCTION,
} from "../prompts/doubaoVisionSystemPrompt.ts";
import {
  VISION_JSON_SCHEMA,
  VisionResultSchema,
  describeSchemaIssues,
  type VisionResult,
} from "./vision-schema.ts";
import { logVisionDiagnostics } from "./vision-diagnostics.ts";

/**
 * Doubao-Seed-2.0-Lite 多模态视觉诊断服务（独立于正式诊断链路）。
 *
 * 设计要点：
 * - 只读服务端环境变量，不支持 NEXT_PUBLIC_*，不内置任何密钥。
 * - 图片以 Base64 Data URL 发送，不上传公开存储桶。
 * - json_schema 结构化输出优先；如模型/接入点不兼容，仅回退一次 json_object。
 * - 网络类错误最多重试一次；错误日志只保留类型、状态码与耗时。
 * - completionFn 可注入，便于完全离线地进行 Mock 测试。
 */

export const VISION_DEFAULTS = {
  /** 单张图片硬上限，避免异常输入消耗过多内存与 token。 */
  maxImageBytes: 8 * 1024 * 1024,
  /** 允许的像素边长上限；超限直接拒绝（不引入重型图像库做自动缩放）。 */
  maxImageDimension: 4096,
  /** 单次 API 请求超时（毫秒）。 */
  timeoutMs: 25_000,
  /** 输出预算：深度思考关闭后，JSON 结果通常远小于此值；留出余量避免 length 截断。 */
  maxCompletionTokens: 2048,
  /** 总请求次数上限：首次 + 最多一次有限重试/回退。 */
  maxAttempts: 2,
  /** 重试前的短暂等待。 */
  retryDelayMs: 300,
} as const;

/**
 * 火山方舟 Chat API 的深度思考开关（顶层字段，不是 Responses API 的 reasoning.effort）。
 * doubao-seed-2-0-lite-260428 带“深度思考”标签，默认启用；结构化诊断任务必须关闭。
 */
export const VISION_THINKING_DISABLED = { type: "disabled" } as const;

export type VisionErrorCode =
  | "CONFIG_MISSING"
  | "FEATURE_DISABLED"
  | "UNSUPPORTED_IMAGE_TYPE"
  | "IMAGE_TOO_LARGE"
  | "INVALID_IMAGE_DATA"
  | "IMAGE_DIMENSIONS_TOO_LARGE"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "API_ERROR"
  | "INVALID_RESPONSE";

export class VisionError extends Error {
  readonly code: VisionErrorCode;
  readonly status?: number;
  readonly durationMs: number;
  readonly fields?: string[];
  /** 仅含长度/计数/状态等安全元数据，不含原文、图片或密钥。 */
  readonly diagnostics?: VisionResponseDiagnostics;

  constructor(
    code: VisionErrorCode,
    message: string,
    options: {
      status?: number;
      durationMs?: number;
      fields?: string[];
      diagnostics?: VisionResponseDiagnostics;
    } = {},
  ) {
    super(message);
    this.name = "VisionError";
    this.code = code;
    this.status = options.status;
    this.durationMs = options.durationMs ?? 0;
    this.fields = options.fields;
    this.diagnostics = options.diagnostics;
  }
}

export interface VisionConfig {
  apiKey: string;
  modelId: string;
  baseURL: string;
  timeoutMs: number;
  enabled: boolean;
}

/**
 * 从服务端环境读取配置。缺失 Key / 模型 ID 时明确报错，不会改用其他厂商模型。
 */
export function readVisionConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): VisionConfig {
  const missing: string[] = [];
  const apiKey = env.ARK_API_KEY?.trim() ?? "";
  const modelId = env.ARK_VISION_MODEL?.trim() ?? "";

  if (!apiKey) missing.push("ARK_API_KEY");
  if (!modelId) missing.push("ARK_VISION_MODEL");
  if (missing.length > 0) {
    throw new VisionError("CONFIG_MISSING", `Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    apiKey,
    modelId,
    baseURL: env.ARK_BASE_URL?.trim() || "https://ark.cn-beijing.volces.com/api/v3",
    timeoutMs: VISION_DEFAULTS.timeoutMs,
    enabled: (env.VISION_DIAGNOSIS_ENABLED ?? "false").trim().toLowerCase() === "true",
  };
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function isSupportedMimeType(value: string): value is SupportedImageMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

interface ImageInspection {
  width?: number;
  height?: number;
  bytes: Uint8Array;
  metadataStripped: boolean;
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  );
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset + 1] << 8) | bytes[offset];
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>>
    0
  );
}

/** JPEG EXIF Orientation 取值 1～8。 */
export type JpegOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * 从 JPEG 的 APP1/Exif 段读取 IFD0 的 Orientation 标签（0x0112，SHORT）。
 * 不修改输入；解析失败返回 null（视为不需要方向归一化）。
 */
export function readJpegOrientation(input: Uint8Array): JpegOrientation | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;
  let offset = 2;

  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) return null;
    let marker = input[offset + 1];
    while (marker === 0xff && offset + 2 < input.length) {
      offset += 1;
      marker = input[offset + 1];
    }
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > input.length) return null;

    const length = readUInt16BE(input, offset);
    if (length < 2 || offset + length > input.length) return null;

    if (marker === 0xe1 && length >= 10) {
      const payload = offset + 2;
      const isExif =
        input[payload] === 0x45 &&
        input[payload + 1] === 0x78 &&
        input[payload + 2] === 0x69 &&
        input[payload + 3] === 0x66 &&
        input[payload + 4] === 0x00 &&
        input[payload + 5] === 0x00;
      if (isExif) {
        const tiff = payload + 6;
        if (tiff + 8 <= input.length) {
          const littleEndian = input[tiff] === 0x49 && input[tiff + 1] === 0x49;
          const bigEndian = input[tiff] === 0x4d && input[tiff + 1] === 0x4d;
          if (littleEndian || bigEndian) {
            const u16 = (at: number) => (littleEndian ? readUInt16LE(input, at) : readUInt16BE(input, at));
            const u32 = (at: number) => (littleEndian ? readUInt32LE(input, at) : readUInt32BE(input, at));
            if (u16(tiff + 2) === 42) {
              const ifd = tiff + u32(tiff + 4);
              if (ifd + 2 <= input.length) {
                const count = u16(ifd);
                for (let i = 0; i < count; i += 1) {
                  const entry = ifd + 2 + i * 12;
                  if (entry + 12 > input.length) break;
                  if (u16(entry) === 0x0112 && u16(entry + 2) === 3 && u32(entry + 4) >= 1) {
                    const value = u16(entry + 8);
                    return value >= 1 && value <= 8 ? (value as JpegOrientation) : null;
                  }
                }
              }
            }
          }
        }
      }
    }
    offset += length;
  }
  return null;
}

/**
 * EXIF Orientation 到实际像素变换的映射（针对已剥离 EXIF 的字节流）：
 * 1 原样；2 水平镜像；3 旋转 180°；4 垂直镜像；
 * 5 转置（镜像+270°）；6 顺时针 90°；7 逆置（镜像+90°）；8 顺时针 270°。
 * sharp 的固定执行顺序为 rotate → flip → flop，已用合成像素验证。
 */
const ORIENTATION_PIXEL_OPERATIONS: Record<
  Exclude<JpegOrientation, 1>,
  { rotate?: 90 | 180 | 270; flip?: boolean; flop?: boolean }
> = {
  2: { flop: true },
  3: { rotate: 180 },
  4: { flip: true },
  5: { rotate: 270, flop: true },
  6: { rotate: 90 },
  7: { rotate: 90, flop: true },
  8: { rotate: 270 },
};

/**
 * 对已经剥离元数据的 JPEG 字节执行方向归一化并重新编码。
 * - 不缩放、不改色彩空间、不做自动白平衡/美颜；
 * - 重新嵌入原 ICC（若存在），保持色彩解释一致；
 * - 使用高质量 4:4:4 编码，尽量降低二次编码损失。
 */
async function normalizeJpegOrientation(
  metadataStrippedBytes: Uint8Array,
  orientation: JpegOrientation,
): Promise<Uint8Array> {
  if (orientation === 1) return metadataStrippedBytes;
  const operation = ORIENTATION_PIXEL_OPERATIONS[orientation];
  const source = Buffer.from(metadataStrippedBytes);

  // 输入已无 EXIF，sharp 不存在自动方向纠正，避免二次旋转。
  const icc = (await sharp(source).metadata()).icc;
  let pipeline = sharp(source);
  if (operation.rotate) pipeline = pipeline.rotate(operation.rotate);
  if (operation.flip) pipeline = pipeline.flip();
  if (operation.flop) pipeline = pipeline.flop();
  pipeline = pipeline.jpeg({ quality: 95, chromaSubsampling: "4:4:4" });
  if (icc && icc.length > 0) pipeline = pipeline.withMetadata({ icc: icc.toString("base64") });

  return new Uint8Array(await pipeline.toBuffer());
}

/** 移除 JPEG 的 APP1(EXIF/XMP)、APP13(IPTC)、COM 段，同时读取 SOF 中的像素尺寸。 */
function inspectAndStripJpeg(input: Uint8Array): ImageInspection {
  const parts: Uint8Array[] = [input.subarray(0, 2)];
  let width: number | undefined;
  let height: number | undefined;
  let metadataStripped = false;
  let offset = 2;

  while (offset + 1 < input.length) {
    if (input[offset] !== 0xff) {
      parts.push(input.subarray(offset));
      break;
    }

    let marker = input[offset + 1];
    while (marker === 0xff && offset + 2 < input.length) {
      offset += 1;
      marker = input[offset + 1];
    }
    offset += 2;

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(input.subarray(offset - 2, offset));
      continue;
    }
    if (marker === 0xd9) {
      parts.push(input.subarray(offset - 2));
      break;
    }

    if (offset + 2 > input.length) break;
    const segmentLength = readUInt16BE(input, offset);
    if (segmentLength < 2 || offset + segmentLength > input.length) {
      parts.push(input.subarray(offset - 2));
      break;
    }

    const isMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (isMetadata) {
      metadataStripped = true;
    } else {
      parts.push(input.subarray(offset - 2, offset + segmentLength));
    }

    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && segmentLength >= 7) {
      height = readUInt16BE(input, offset + 3);
      width = readUInt16BE(input, offset + 5);
    }

    offset += segmentLength;
    if (marker === 0xda) {
      // SOS 之后是熵编码数据，原样保留并结束解析。
      parts.push(input.subarray(offset));
      break;
    }
  }

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  return { width, height, bytes: merged, metadataStripped };
}

/** 移除 PNG 的文本/EXIF/时间辅助 chunk，保留 IHDR/IDAT/IEND 等解码必需 chunk。 */
function inspectAndStripPng(input: Uint8Array): ImageInspection {
  const removableTypes = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  const parts: Uint8Array[] = [input.subarray(0, 8)];
  let width: number | undefined;
  let height: number | undefined;
  let metadataStripped = false;
  let offset = 8;

  while (offset + 12 <= input.length) {
    const chunkLength = readUInt32BE(input, offset);
    const type = String.fromCharCode(input[offset + 4], input[offset + 5], input[offset + 6], input[offset + 7]);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkLength > input.length || chunkEnd > input.length) {
      parts.push(input.subarray(offset));
      break;
    }

    if (removableTypes.has(type)) {
      metadataStripped = true;
    } else {
      parts.push(input.subarray(offset, chunkEnd));
    }

    if (type === "IHDR" && chunkLength >= 8) {
      width = readUInt32BE(input, offset + 8);
      height = readUInt32BE(input, offset + 12);
    }

    offset = chunkEnd;
    if (type === "IEND") break;
  }

  if (offset < input.length) parts.push(input.subarray(offset));

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  return { width, height, bytes: merged, metadataStripped };
}

/** WebP 只做尺寸读取；不改动 RIFF 结构，避免破坏图像。 */
function inspectWebp(input: Uint8Array): ImageInspection {
  let width: number | undefined;
  let height: number | undefined;
  if (input.length >= 30) {
    const chunkType = String.fromCharCode(input[12], input[13], input[14], input[15]);
    if (chunkType === "VP8X") {
      width = 1 + input[24] + (input[25] << 8) + (input[26] << 16);
      height = 1 + input[27] + (input[28] << 8) + (input[29] << 16);
    } else if (chunkType === "VP8L" && input[20] === 0x2f) {
      const bits = input[21] | (input[22] << 8) | (input[23] << 16) | (input[24] << 24);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (chunkType === "VP8 " && input.length >= 30) {
      width = (input[26] | (input[27] << 8)) & 0x3fff;
      height = (input[28] | (input[29] << 8)) & 0x3fff;
    }
  }
  return { width, height, bytes: input, metadataStripped: false };
}

export interface PreparedVisionImage {
  dataUrl: string;
  mimeType: SupportedImageMimeType;
  originalBytes: number;
  sentBytes: number;
  width?: number;
  height?: number;
  metadataStripped: boolean;
  /** JPEG 原始 EXIF Orientation；非 JPEG 或不存在时为 null。 */
  orientation: JpegOrientation | null;
  /** 是否实际执行了像素级方向归一化。 */
  orientationApplied: boolean;
  /** 方向归一化前的像素尺寸（仅用于脱敏诊断日志）。 */
  inputWidth?: number;
  inputHeight?: number;
}

function assertImageDimensions(
  width: number | undefined,
  height: number | undefined,
  maxDimension: number,
): void {
  if ((width !== undefined && width > maxDimension) || (height !== undefined && height > maxDimension)) {
    throw new VisionError("IMAGE_DIMENSIONS_TOO_LARGE", `Image dimensions exceed ${maxDimension}px`);
  }
}

/**
 * 校验图片真实格式（magic bytes）、大小与像素尺寸，剥离元数据并生成 Data URL。
 *
 * JPEG 会在剥离 EXIF 之前读取 Orientation 1～8，并对像素做实际旋转/镜像，
 * 避免“只删标签不转像素”导致手机竖拍照片横置送入 Doubao。
 * 非 JPEG 不引入方向变换。不会把图片写入磁盘，也不会上传到任何公开存储。
 */
export async function prepareVisionImage(
  imageBuffer: Uint8Array,
  mimeType: string,
  limits: { maxImageBytes?: number; maxImageDimension?: number } = {},
): Promise<PreparedVisionImage> {
  const normalizedMime = mimeType.split(";")[0].trim().toLowerCase();
  if (!isSupportedMimeType(normalizedMime)) {
    throw new VisionError("UNSUPPORTED_IMAGE_TYPE", `Unsupported image MIME type: ${normalizedMime || "(empty)"}`);
  }
  if (imageBuffer.byteLength === 0) {
    throw new VisionError("INVALID_IMAGE_DATA", "Image buffer is empty");
  }

  const maxBytes = limits.maxImageBytes ?? VISION_DEFAULTS.maxImageBytes;
  if (imageBuffer.byteLength > maxBytes) {
    throw new VisionError("IMAGE_TOO_LARGE", `Image exceeds ${maxBytes} bytes`);
  }

  const hasSignature = (signature: number[], offset = 0) =>
    signature.every((byte, index) => imageBuffer[offset + index] === byte);

  let inputInspection: ImageInspection;
  let orientation: JpegOrientation | null = null;
  if (normalizedMime === "image/jpeg") {
    if (!hasSignature([0xff, 0xd8, 0xff])) {
      throw new VisionError("INVALID_IMAGE_DATA", "Image bytes do not match JPEG signature");
    }
    orientation = readJpegOrientation(imageBuffer);
    inputInspection = inspectAndStripJpeg(imageBuffer);
  } else if (normalizedMime === "image/png") {
    if (!hasSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      throw new VisionError("INVALID_IMAGE_DATA", "Image bytes do not match PNG signature");
    }
    inputInspection = inspectAndStripPng(imageBuffer);
  } else {
    if (!hasSignature([0x52, 0x49, 0x46, 0x46]) || !hasSignature([0x57, 0x45, 0x42, 0x50], 8)) {
      throw new VisionError("INVALID_IMAGE_DATA", "Image bytes do not match WebP signature");
    }
    inputInspection = inspectWebp(imageBuffer);
  }

  const maxDimension = limits.maxImageDimension ?? VISION_DEFAULTS.maxImageDimension;
  assertImageDimensions(inputInspection.width, inputInspection.height, maxDimension);

  let inspection = inputInspection;
  let orientationApplied = false;
  if (orientation !== null && orientation !== 1) {
    try {
      const normalized = await normalizeJpegOrientation(inputInspection.bytes, orientation);
      inspection = inspectAndStripJpeg(normalized);
      orientationApplied = true;
    } catch {
      // 不暴露图像处理库的错误原文（可能含路径/内部信息）。
      throw new VisionError("INVALID_IMAGE_DATA", "Failed to normalize JPEG orientation");
    }
    assertImageDimensions(inspection.width, inspection.height, maxDimension);
  }

  const sentBytes = inspection.bytes.byteLength;
  if (sentBytes === 0) {
    throw new VisionError("INVALID_IMAGE_DATA", "Processed image is empty");
  }
  // 方向归一化会重新编码 JPEG；给输出留一个宽松上界，防止异常膨胀。
  if (sentBytes > maxBytes * 2) {
    throw new VisionError("IMAGE_TOO_LARGE", `Processed image exceeds ${maxBytes * 2} bytes`);
  }

  return {
    dataUrl: `data:${normalizedMime};base64,${Buffer.from(inspection.bytes).toString("base64")}`,
    mimeType: normalizedMime,
    originalBytes: imageBuffer.byteLength,
    sentBytes,
    width: inspection.width,
    height: inspection.height,
    metadataStripped: inputInspection.metadataStripped || inspection.metadataStripped,
    orientation,
    orientationApplied,
    inputWidth: inputInspection.width,
    inputHeight: inputInspection.height,
  };
}

export interface VisionResponseFormat {
  type: "json_schema" | "json_object";
  json_schema?: {
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    strict: boolean;
  };
}

export type VisionMessage =
  | { role: "system"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail: "auto" | "low" | "high" } }
      >;
    };

export interface VisionCompletionRequest {
  model: string;
  messages: VisionMessage[];
  response_format: VisionResponseFormat;
  temperature: number;
  max_completion_tokens: number;
  timeout: number;
  /** Chat API 顶层字段；不传会让该模型默认启用深度思考。 */
  thinking?: { type: "disabled" | "enabled" | "auto" };
}

/** 只保存安全的响应元数据，绝不保存原文或图片。 */
export interface VisionResponseDiagnostics {
  httpStatus: number | null;
  finishReason: string | null;
  contentLength: number;
  contentEmpty: boolean;
  reasoningContentPresent: boolean;
  reasoningContentLength: number;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  requestId: string | null;
  modelReturned: string | null;
}

export interface VisionCompletionResponse {
  content: string | null;
  /** Mock 测试可只提供 content；新字段均可选，由 normalize 补齐默认值。 */
  diagnostics?: Partial<VisionResponseDiagnostics>;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
    completion_tokens_details?: { reasoning_tokens?: number | null } | null;
  } | null;
}

export type VisionCompletionFn = (request: VisionCompletionRequest) => Promise<VisionCompletionResponse>;

/** SDK 响应中与诊断相关的字段形状（不依赖 SDK 类型，便于离线测试）。 */
export interface RawArkCompletionLike {
  id?: string | null;
  model?: string | null;
  _request_id?: string | null;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | unknown[] | null;
      reasoning_content?: string | null;
    } | null;
  }> | null;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
    completion_tokens_details?: { reasoning_tokens?: number | null } | null;
  } | null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** 把 SDK 原始响应转换成可打印的安全诊断数据，不保留任何文本原文。 */
export function normalizeArkCompletion(
  raw: RawArkCompletionLike,
  httpStatus: number | null = null,
  headerRequestId: string | null = null,
): VisionCompletionResponse {
  const choice = raw.choices?.[0];
  const message = choice?.message;
  const rawContent = message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  const reasoning = message?.reasoning_content;
  const reasoningLength = typeof reasoning === "string" ? reasoning.length : 0;

  return {
    content,
    usage: {
      prompt_tokens: raw.usage?.prompt_tokens ?? null,
      completion_tokens: raw.usage?.completion_tokens ?? null,
      total_tokens: raw.usage?.total_tokens ?? null,
      completion_tokens_details: {
        reasoning_tokens: raw.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      },
    },
    diagnostics: {
      httpStatus,
      finishReason: nullableString(choice?.finish_reason),
      contentLength: content?.length ?? 0,
      contentEmpty: !content || content.trim().length === 0,
      reasoningContentPresent: reasoningLength > 0,
      reasoningContentLength: reasoningLength,
      promptTokens: raw.usage?.prompt_tokens ?? null,
      completionTokens: raw.usage?.completion_tokens ?? null,
      reasoningTokens: raw.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      totalTokens: raw.usage?.total_tokens ?? null,
      requestId: nullableString(headerRequestId) ?? nullableString(raw._request_id) ?? nullableString(raw.id),
      modelReturned: nullableString(raw.model),
    },
  };
}

/** Mock 注入时给出安全的默认诊断值。 */
function fallbackDiagnostics(partial: Partial<VisionResponseDiagnostics> | undefined): VisionResponseDiagnostics {
  const contentLength = partial?.contentLength ?? 0;
  return {
    httpStatus: partial?.httpStatus ?? null,
    finishReason: partial?.finishReason ?? null,
    contentLength,
    contentEmpty: partial?.contentEmpty ?? contentLength === 0,
    reasoningContentPresent: partial?.reasoningContentPresent ?? false,
    reasoningContentLength: partial?.reasoningContentLength ?? 0,
    promptTokens: partial?.promptTokens ?? null,
    completionTokens: partial?.completionTokens ?? null,
    reasoningTokens: partial?.reasoningTokens ?? null,
    totalTokens: partial?.totalTokens ?? null,
    requestId: partial?.requestId ?? null,
    modelReturned: partial?.modelReturned ?? null,
  };
}

/** 生产环境的完成函数调用器：复用 openai SDK 访问火山方舟兼容接口。 */
export function createArkCompletion(config: VisionConfig): VisionCompletionFn {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: config.timeoutMs,
    maxRetries: 0,
  });

  return async (request) => {
    const { data, response, request_id } = await client.chat.completions
      .create({
        model: request.model,
        messages: request.messages,
        response_format: request.response_format,
        temperature: request.temperature,
        max_completion_tokens: request.max_completion_tokens,
        thinking: request.thinking,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)
      .withResponse();

    return normalizeArkCompletion(data as RawArkCompletionLike, response.status, request_id);
  };
}

export interface VisionUsage {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  /** 来自 usage.completion_tokens_details.reasoning_tokens；未提供则为 null。 */
  reasoning_tokens: number | null;
  total_tokens: number | null;
  /** api_usage=全部来自响应；partial=仅部分字段来自响应；unavailable=响应未提供。 */
  source: "api_usage" | "partial" | "unavailable";
}

export interface VisionCallMeta {
  modelId: string;
  durationMs: number;
  attempts: number;
  usage: VisionUsage;
  responseFormat: "json_schema" | "json_object";
  /** 安全的响应元数据，供测试脚本与后续实验使用。 */
  response: VisionResponseDiagnostics;
  image: {
    mimeType: SupportedImageMimeType;
    originalBytes: number;
    sentBytes: number;
    width?: number;
    height?: number;
    metadataStripped: boolean;
    /** 旧测试/Mock 可省略这两个字段；真实调用始终提供。 */
    orientation?: JpegOrientation | null;
    orientationApplied?: boolean;
    inputWidth?: number;
    inputHeight?: number;
  };
}

export interface VisionAnalysisResult {
  result: VisionResult;
  meta: VisionCallMeta;
}

export interface AnalyzeVisionOptions {
  /** 用于离线测试；传入时跳过 enabled 开关检查。 */
  config?: VisionConfig;
  /** 用于离线测试；传入时不会创建真实 SDK 客户端。 */
  completionFn?: VisionCompletionFn;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** 覆盖输出 token 预算，便于实验；默认 VISION_DEFAULTS.maxCompletionTokens。 */
  maxCompletionTokens?: number;
}

const SCHEMA_FORMAT: VisionResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "season_vision_diagnosis",
    description: "基于人像照片可观察色彩特征的四季型相对匹配分析。",
    schema: VISION_JSON_SCHEMA as unknown as Record<string, unknown>,
    strict: true,
  },
};

const JSON_OBJECT_FORMAT: VisionResponseFormat = { type: "json_object" };

interface ClassifiedApiError {
  code: VisionErrorCode;
  status?: number;
  retryable: boolean;
  schemaIncompatible: boolean;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const value = (error as { status?: unknown }).status;
  return typeof value === "number" ? value : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

function classifyApiError(error: unknown): ClassifiedApiError {
  const status = errorStatus(error);
  const message = errorMessage(error);
  const name = error instanceof Error ? error.name : "";

  if (name === "AbortError" || name === "TimeoutError" || /timeout|timed out|ETIMEDOUT/i.test(message)) {
    return { code: "TIMEOUT", status, retryable: true, schemaIncompatible: false };
  }
  if (status === 401 || status === 403) {
    return { code: "AUTH_FAILED", status, retryable: false, schemaIncompatible: false };
  }
  if (status === 429) {
    return { code: "RATE_LIMITED", status, retryable: true, schemaIncompatible: false };
  }
  if (status === 400 && /response_format|json_schema|structured output|not support|unsupported/i.test(message)) {
    return { code: "API_ERROR", status, retryable: false, schemaIncompatible: true };
  }
  return {
    code: "API_ERROR",
    status,
    retryable: status !== undefined && status >= 500,
    schemaIncompatible: false,
  };
}

function toTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function extractUsage(raw: VisionCompletionResponse["usage"]): VisionUsage {
  const prompt_tokens = toTokenCount(raw?.prompt_tokens);
  const completion_tokens = toTokenCount(raw?.completion_tokens);
  const reasoning_tokens = toTokenCount(raw?.completion_tokens_details?.reasoning_tokens);
  const total_tokens = toTokenCount(raw?.total_tokens);
  const present = [prompt_tokens, completion_tokens, total_tokens].filter((v) => v !== null).length;
  return {
    prompt_tokens,
    completion_tokens,
    reasoning_tokens,
    total_tokens,
    source: present === 3 ? "api_usage" : present > 0 ? "partial" : "unavailable",
  };
}

function cleanJsonText(content: string): string {
  return content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

/**
 * 执行一次独立视觉诊断。默认从环境变量读取配置；测试可注入 config + completionFn。
 * 成功返回经 Zod 严格校验的结果与调用元信息；任何失败都抛出 VisionError。
 */
export async function analyzeSeasonWithDoubao(
  imageBuffer: Uint8Array,
  mimeType: string,
  options: AnalyzeVisionOptions = {},
): Promise<VisionAnalysisResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const duration = () => Math.max(0, now() - startedAt);

  const config = options.config ?? readVisionConfigFromEnv();
  if (!config.enabled && !options.completionFn) {
    throw new VisionError("FEATURE_DISABLED", "Vision diagnosis is disabled (VISION_DIAGNOSIS_ENABLED)", {
      durationMs: duration(),
    });
  }

  const prepared = await prepareVisionImage(imageBuffer, mimeType);
  logVisionDiagnostics("vision.image", {
    mimeType: prepared.mimeType,
    inputWidth: prepared.inputWidth,
    inputHeight: prepared.inputHeight,
    width: prepared.width,
    height: prepared.height,
    originalBytes: prepared.originalBytes,
    sentBytes: prepared.sentBytes,
    orientation: prepared.orientation,
    orientationApplied: prepared.orientationApplied,
    metadataStripped: prepared.metadataStripped,
  });
  const completion = options.completionFn ?? createArkCompletion(config);

  const request: VisionCompletionRequest = {
    model: config.modelId,
    messages: [
      { role: "system", content: DOUBAO_VISION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: DOUBAO_VISION_USER_INSTRUCTION },
          {
            type: "image_url",
            image_url: { url: prepared.dataUrl, detail: "auto" },
          },
        ],
      },
    ],
    response_format: SCHEMA_FORMAT,
    temperature: 0,
    max_completion_tokens: options.maxCompletionTokens ?? VISION_DEFAULTS.maxCompletionTokens,
    timeout: config.timeoutMs,
    // 该模型默认开启深度思考；若不显式关闭，思考 token 会挤占输出预算导致 content 为空。
    thinking: VISION_THINKING_DISABLED,
  };

  let lastError: unknown;
  let response: VisionCompletionResponse | undefined;
  let responseFormat: "json_schema" | "json_object" = "json_schema";
  let attempts = 0;

  for (let attempt = 1; attempt <= VISION_DEFAULTS.maxAttempts; attempt += 1) {
    attempts = attempt;
    const format = responseFormat === "json_schema" ? SCHEMA_FORMAT : JSON_OBJECT_FORMAT;
    try {
      response = await completion({ ...request, response_format: format });
      break;
    } catch (error) {
      lastError = error;
      const classified = classifyApiError(error);

      if (classified.schemaIncompatible && attempt < VISION_DEFAULTS.maxAttempts) {
        responseFormat = "json_object";
        continue;
      }
      if (classified.retryable && attempt < VISION_DEFAULTS.maxAttempts) {
        const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
        await sleep(VISION_DEFAULTS.retryDelayMs);
        continue;
      }
      break;
    }
  }

  if (!response) {
    const classified = classifyApiError(lastError);
    const hint =
      classified.status === 404 || classified.status === 400
        ? "; check ARK_VISION_MODEL / ARK_BASE_URL"
        : "";
    const error = new VisionError(
      classified.code,
      `Vision API request failed (${classified.code}, status=${classified.status ?? "unknown"})${hint}`,
      {
        status: classified.status,
        durationMs: duration(),
        diagnostics: fallbackDiagnostics({ httpStatus: classified.status ?? null }),
      },
    );
    // 只记录错误类型、状态码与耗时，不记录错误原文或请求内容。
    console.error("[doubao-vision] request failed", {
      code: error.code,
      status: error.status,
      durationMs: error.durationMs,
    });
    logVisionDiagnostics("vision.failure", {
      code: error.code,
      status: error.status,
      durationMs: error.durationMs,
      modelId: config.modelId,
    });
    throw error;
  }

  const diagnostics = fallbackDiagnostics(response.diagnostics);
  const content = response.content;
  const budgetExhausted = diagnostics.finishReason === "length";

  if (!content || content.trim().length === 0) {
    // 特别注意：finish_reason=length 时是输出预算被截断，绝不能当作成功结果。
    const cause = budgetExhausted
      ? "output budget exhausted (finish_reason=length)"
      : diagnostics.reasoningContentPresent || (diagnostics.reasoningTokens ?? 0) > 0
        ? "possible deep-thinking tokens consumed the output budget"
        : "empty message content";
    throw new VisionError("INVALID_RESPONSE", `Vision API returned empty content: ${cause}`, {
      durationMs: duration(),
      diagnostics,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonText(content));
  } catch {
    const hint = budgetExhausted ? " (finish_reason=length: truncated output)" : "";
    throw new VisionError("INVALID_RESPONSE", `Vision API response is not valid JSON${hint}`, {
      durationMs: duration(),
      diagnostics,
    });
  }

  const validated = VisionResultSchema.safeParse(parsed);
  if (!validated.success) {
    const fields = describeSchemaIssues(validated.error);
    throw new VisionError("INVALID_RESPONSE", `Vision API response failed schema validation at: ${fields.join(", ")}`, {
      durationMs: duration(),
      fields,
      diagnostics,
    });
  }

  const meta: VisionCallMeta = {
    modelId: config.modelId,
    durationMs: duration(),
    attempts,
    usage: extractUsage(response.usage),
    responseFormat,
    response: diagnostics,
    image: {
      mimeType: prepared.mimeType,
      originalBytes: prepared.originalBytes,
      sentBytes: prepared.sentBytes,
      width: prepared.width,
      height: prepared.height,
      metadataStripped: prepared.metadataStripped,
      orientation: prepared.orientation,
      orientationApplied: prepared.orientationApplied,
      inputWidth: prepared.inputWidth,
      inputHeight: prepared.inputHeight,
    },
  };

  logVisionDiagnostics("vision.result", {
    modelId: meta.modelId,
    durationMs: meta.durationMs,
    attempts: meta.attempts,
    responseFormat: meta.responseFormat,
    finishReason: diagnostics.finishReason,
    requestId: diagnostics.requestId,
    promptTokens: diagnostics.promptTokens,
    completionTokens: diagnostics.completionTokens,
    reasoningTokens: diagnostics.reasoningTokens,
    totalTokens: diagnostics.totalTokens,
    usageSource: meta.usage.source,
    canJudgeReliably: validated.data.can_judge_reliably,
    lightingWarning: validated.data.lighting_warning,
    filterWarning: validated.data.filter_warning,
  });

  // 只输出长度、计数、状态与 ID，不输出任何原文、图片或密钥。
  console.info("[doubao-vision] request completed", {
    modelId: meta.modelId,
    durationMs: meta.durationMs,
    attempts: meta.attempts,
    responseFormat: meta.responseFormat,
    usageSource: meta.usage.source,
    canJudgeReliably: validated.data.can_judge_reliably,
    httpStatus: diagnostics.httpStatus,
    finishReason: diagnostics.finishReason,
    contentLength: diagnostics.contentLength,
    reasoningContentLength: diagnostics.reasoningContentLength,
    reasoningTokens: diagnostics.reasoningTokens,
    requestId: diagnostics.requestId,
  });

  return { result: validated.data, meta };
}

export const analyzeSeasonWithDoubaoVision = analyzeSeasonWithDoubao;
