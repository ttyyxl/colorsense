import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isBlockingDiagnosisStatus, resolveDiagnosisStatusOf } from "@/lib/diagnosis-status";
import type { SeasonType } from "@/lib/seasons";
import type { LabFeatures } from "@/lib/types";

export const runtime = "nodejs";

/**
 * 个人形象分析图卡（Seedream 文生图 / 图生图）服务端接口。
 *
 * 设计要点（与远程实现的主要差异）：
 * 1. 不再信任客户端传入的季型、颜色与诊断状态，改为按 diagnosisId 读取诊断记录，
 *    在服务端重新做归属校验与状态机校验后再决定是否允许生图。
 * 2. 密钥只从服务端环境变量 DOUBAO_IMAGE_API_KEY 读取，代码中不含任何硬编码密钥，
 *    也不复用穿搭建议（DOUBAO_API_KEY）或视觉诊断（ARK_API_KEY）的密钥。
 * 3. 第三方原始响应（含错误详情）只写服务端日志，不透传给客户端。
 */

/* ------------------------------------------------------------------ */
/* 常量与配置                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_IMAGE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
/** Seedream 5.0 flash 官方 Model ID；可用 DOUBAO_IMAGE_MODEL 覆盖。 */
const DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-flash-260915";
/** Seedream 5.0 flash 的 2K / 16:9 尺寸，用于六联横向排版。 */
const DEFAULT_IMAGE_SIZE = "2816x1584";
const DEFAULT_TIMEOUT_MS = 90_000;

/** 图卡固定六组颜色。 */
const PALETTE_SIZE = 6;
/** 允许的参考图 MIME 前缀（Ark 支持 jpeg/png/webp 等，这里只放行最常用的三种）。 */
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
/** 请求体上限（base64 参考图约 4MB，对应约 3MB 二进制）。 */
const MAX_BODY_BYTES = 5 * 1024 * 1024;
/** 单个用户 10 分钟内允许的付费生图次数。 */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const SEASON_KEYS: SeasonType[] = ["spring", "summer", "autumn", "winter"];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export interface StyleImageConfig {
  /** 生图服务总开关；关闭后不发起任何付费请求。 */
  enabled: boolean;
  /** 生图专用 API Key（服务端环境变量）。 */
  apiKey: string;
  /** Ark OpenAI 兼容端点。 */
  baseUrl: string;
  /** 模型 ID。 */
  model: string;
  /** 输出尺寸。 */
  size: string;
  /** 单次请求超时（毫秒）。 */
  timeoutMs: number;
}

/** 服务端从 Firestore 读到的诊断记录关键字段。 */
export interface DiagnosisSnapshot {
  userId?: string;
  seasonType?: string;
  colorPalette?: string[];
  labFeatures?: LabFeatures;
  diagnosisStatus?: string;
  fusionDiagnosis?: unknown;
}

/** 便于测试注入的依赖集合；生产环境使用 defaultDeps。 */
export interface StyleImageDeps {
  authenticate: () => Promise<{ uid: string } | null>;
  loadDiagnosis: (diagnosisId: string) => Promise<DiagnosisSnapshot | null>;
  fetchImpl: (input: string, init: RequestInit) => Promise<Response>;
  config: StyleImageConfig;
  now: () => number;
}
/* ------------------------------------------------------------------ */
/* 限流                                                                */
/* ------------------------------------------------------------------ */

const generationTimestamps = new Map<string, number[]>();

/** 仅供测试重置限流状态。 */
function resetStyleImageRateLimit(): void {
  generationTimestamps.clear();
}

function consumeQuota(uid: string, now: number): boolean {
  const recent = (generationTimestamps.get(uid) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    generationTimestamps.set(uid, recent);
    return false;
  }
  recent.push(now);
  generationTimestamps.set(uid, recent);
  return true;
}

/* ------------------------------------------------------------------ */
/* 颜色与参考图处理                                                    */
/* ------------------------------------------------------------------ */

/**
 * 把 hex 色值转换成更贴近自然语言的颜色描述，便于文生图模型理解。
 * 同时保留 hex 让模型尽量还原精确色值。
 */
function describeHex(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)) / 255;

  let hue = 0;
  if (max !== min) {
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  let family = "中性色";
  if (s < 0.12) family = l > 0.85 ? "纯白色" : l < 0.15 ? "纯黑色" : "灰色调";
  else if (hue < 15 || hue >= 345) family = "红色系";
  else if (hue < 45) family = "橙色系";
  else if (hue < 70) family = "黄色系";
  else if (hue < 160) family = "绿色系";
  else if (hue < 200) family = "青色系";
  else if (hue < 260) family = "蓝色系";
  else if (hue < 300) family = "紫色系";
  else family = "玫红色系";

  const tone = l > 0.7 ? "浅" : l < 0.35 ? "深" : "中";
  return `${tone}${family}（色值 ${hex}）`;
}

/**
 * 根据季节与 LAB 肤色特征生成人物描述，尽量保留真实肤色与气质。
 */
function buildSubjectDescription(season?: string, lab?: LabFeatures): string {
  let skinDesc = "自然真实的亚洲肤色";
  if (lab && Number.isFinite(lab.L) && Number.isFinite(lab.a) && Number.isFinite(lab.b)) {
    const l = lab.L ?? 60;
    const a = lab.a ?? 0;
    const b = lab.b ?? 0;
    const lightness = l > 70 ? "白皙透亮" : l > 55 ? "自然均匀" : l > 40 ? "健康小麦" : "健康深色";
    const warm = b > 8 || a > 6 ? "暖调" : b < -2 || a < 0 ? "冷调" : "中性调";
    skinDesc = `${lightness}的${warm}亚洲肤色`;
  }

  const seasonMap: Record<string, string> = {
    spring: "春日清新、温暖明亮的气质",
    summer: "夏日柔和、优雅知性的气质",
    autumn: "秋日成熟、温暖大气的气质",
    winter: "冬日冷峻、干练高级的气质",
  };
  const vibe = season ? seasonMap[season] : "干净自然的气质";

  return `一位年轻的东亚人物，${skinDesc}，五官脸型保持自然真实，保留皮肤纹理与真实细节，不要过度磨皮或修图，整体呈现${vibe}。`;
}

/**
 * 生成六联服装颜色对比图卡的提示词。
 * 提示词长度按官方建议控制在 300 汉字左右，避免模型忽略细节。
 */
function buildPrompt(
  colors: string[],
  season?: string,
  lab?: LabFeatures,
  hasImage = false,
): string {
  const palette = colors.slice(0, PALETTE_SIZE);
  while (palette.length < PALETTE_SIZE) {
    palette.push(palette[palette.length - 1] || "#C0C0C0");
  }

  const colorList = palette
    .map((c, i) => `第${i + 1}张：${describeHex(c)}纯色上衣`)
    .join("；");

  const subject = buildSubjectDescription(season, lab);

  const parts = [
    "一张横向六联「服装颜色模拟」图卡，画面从左到右均匀排列六张等宽竖版半身肖像，六张必须是同一个人物，姿势、表情、发型、五官脸型、肤色完全一致，只有上身服装颜色不同。",
    subject,
    `${colorList}。每张均为同色圆领内搭外搭同色西装外套，内外同色。`,
    "严格要求：整套服装只使用一种纯色，禁止图案、印花、logo、字母、条纹、格纹、波点、拼接、撞色、渐变或第二种颜色；除肤色、发色、浅灰背景与该套纯色服装外不得出现其他颜色。",
    "纯净浅灰影棚背景，柔和均匀自然光，专业肖像摄影，杂志大片质感，干净高级极简。",
    "左上角标题「服装颜色模拟」，右上角小字「DIFFERENT COLORS / DIFFERENT VIBES」，每张肖像下方有对应颜色的小圆点色卡与名称标签。宽高比16:9。",
  ];

  if (hasImage) {
    parts.push(
      "必须严格保留参考图中人物的五官、脸型、发型、肤色与气质，不换脸、不改变面部特征，只保留面部与头发，把身上衣服全部替换为上述对应的单一纯色套装，不沿用参考图原有的服装颜色、图案与配饰，保留真实皮肤质感。",
    );
  } else {
    parts.push(
      "六张脸必须完全一致，像同一张照片只换了纯色衣服，不换脸、不改变五官，不美颜过度，保持真实皮肤质感。",
    );
  }

  return parts.join(" ");
}

/** 校验并归一化客户端传入的参考图，返回可安全转发给 Ark 的字符串。 */
function normalizeReferenceImage(value: unknown): { ok: true; image: string } | { ok: false; reason: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: false, reason: "缺少参考图" };
  }
  if (typeof value !== "string") {
    return { ok: false, reason: "参考图格式非法" };
  }
  if (value.length > MAX_BODY_BYTES) {
    return { ok: false, reason: "参考图过大" };
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return { ok: true, image: value };
  }
  const match = /^data:([a-zA-Z]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) {
    return { ok: false, reason: "参考图格式非法" };
  }
  const mime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, reason: "参考图格式非法" };
  }
  // Ark 要求 base64 data URL 的 MIME 部分使用小写。
  return { ok: true, image: `data:${mime};base64,${match[2]}` };
}

/** 从诊断记录中取出合法的推荐色卡（最多六种，非法色值被丢弃）。 */
function pickPalette(record: DiagnosisSnapshot): string[] {
  const source = Array.isArray(record.colorPalette) ? record.colorPalette : [];
  const valid = source.filter((c): c is string => typeof c === "string" && HEX_COLOR.test(c.trim())).map((c) => c.trim());
  return valid.slice(0, PALETTE_SIZE);
}

/** 解析诊断记录的可靠性状态；老记录没有该字段时按 CONFIDENT 处理。 */
function resolveDiagnosisStatus(record: DiagnosisSnapshot): string {
  return resolveDiagnosisStatusOf({
    diagnosisStatus: record.diagnosisStatus,
    fusionDiagnosis: record.fusionDiagnosis,
  });
}

/* ------------------------------------------------------------------ */
/* 处理器                                                              */
/* ------------------------------------------------------------------ */

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });
}

/**
 * 生图主流程。所有外部依赖均可注入，便于用 Mock 测试且默认不发起真实付费请求。
 */
async function handleGenerateStyleImage(request: Request, deps: StyleImageDeps): Promise<Response> {
  const { config } = deps;

  // 1. 鉴权：复用现有 Firebase ID Token 校验，不新增独立鉴权体系。
  const user = await deps.authenticate();
  if (!user) {
    return jsonError("请先登录后再生成图卡。", 401, "UNAUTHORIZED");
  }

  // 2. 请求体大小限制（base64 参考图较大，先按原始文本长度拦截）。
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonError("请求内容过大，请重试。", 413, "PAYLOAD_TOO_LARGE");
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonError("请求格式非法。", 400, "INVALID_REQUEST");
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return jsonError("请求格式非法。", 400, "INVALID_REQUEST");
  }

  const diagnosisId = typeof payload.diagnosisId === "string" ? payload.diagnosisId.trim() : "";
  if (!diagnosisId || diagnosisId.length > 1500 || !/^[A-Za-z0-9_-]+$/.test(diagnosisId)) {
    return jsonError("缺少有效的诊断记录 ID。", 400, "INVALID_DIAGNOSIS_ID");
  }

  // 3. 读取诊断记录并校验归属（服务端不信任客户端传入的季型 / 颜色 / 状态）。
  let record: DiagnosisSnapshot | null = null;
  try {
    record = await deps.loadDiagnosis(diagnosisId);
  } catch (error) {
    console.error("[generate-style-image] failed to load diagnosis", {
      diagnosisId,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError("诊断记录读取失败，请稍后重试。", 500, "DIAGNOSIS_LOOKUP_FAILED");
  }
  if (!record) {
    return jsonError("没有找到对应的诊断记录。", 404, "DIAGNOSIS_NOT_FOUND");
  }
  if (record.userId !== user.uid) {
    console.warn("[generate-style-image] forbidden diagnosis access", { diagnosisId, userId: user.uid });
    return jsonError("无权访问该诊断记录。", 403, "FORBIDDEN");
  }

  // 4. 诊断状态机（Phase 3.3）：只有硬阻断状态才拒绝生成。
  //    UNCERTAIN / DEGRADED 已有合法季型结果，允许继续生成个性化推荐图卡；
  //    RETAKE_REQUIRED / FAILED 没有有效季型结果，禁止生成任何图卡。
  const status = resolveDiagnosisStatus(record);
  if (isBlockingDiagnosisStatus(status)) {
    return jsonError(
      "本次诊断未产出有效季型结果（状态：" + status + "），暂不生成推荐图卡。",
      403,
      "DIAGNOSIS_NOT_FORMAL",
    );
  }

  // 5. 色卡与季型取自诊断记录。
  const colors = pickPalette(record);
  if (colors.length === 0) {
    return jsonError("诊断记录中没有可用的推荐色卡。", 422, "NO_PALETTE");
  }
  const season = SEASON_KEYS.includes(record.seasonType as SeasonType)
    ? (record.seasonType as SeasonType)
    : undefined;
  const labFeatures = record.labFeatures;

  // 6. 参考图校验（缺失时降级为纯文生图）。
  let referenceImage: string | undefined;
  if (payload.image !== undefined && payload.image !== null && payload.image !== "") {
    const normalized = normalizeReferenceImage(payload.image);
    if (!normalized.ok) {
      return jsonError("参考照片格式不受支持，请重新上传后再试。", 400, "INVALID_REFERENCE_IMAGE");
    }
    referenceImage = normalized.image;
  }

  // 7. 服务可用性检查：缺少生图配置时明确返回服务不可用，不发起任何付费请求。
  if (!config.enabled) {
    return jsonError("图卡生成服务当前未启用。", 503, "IMAGE_SERVICE_DISABLED");
  }
  if (!config.apiKey) {
    console.error("[generate-style-image] DOUBAO_IMAGE_API_KEY is not configured");
    return jsonError("图卡生成服务暂不可用（缺少服务端生图配置）。", 503, "IMAGE_SERVICE_UNAVAILABLE");
  }

  // 8. 调用频率限制（按用户维度，控制付费调用成本）。
  const now = deps.now();
  if (!consumeQuota(user.uid, now)) {
    return jsonError("生成过于频繁，请稍后再试。", 429, "RATE_LIMITED");
  }

  const prompt = buildPrompt(colors, season, labFeatures, Boolean(referenceImage));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      prompt,
      response_format: "url",
      size: config.size,
      watermark: false,
    };
    if (referenceImage) {
      requestBody.image = referenceImage;
    }

    const upstream = await deps.fetchImpl(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const data = (await upstream.json().catch(() => null)) as
      | { data?: Array<{ url?: string }>; error?: { message?: string } }
      | null;

    if (!upstream.ok) {
      // 第三方错误详情只写服务端日志，不透传客户端。
      console.error("[generate-style-image] upstream error", {
        status: upstream.status,
        message: data?.error?.message ?? "unknown",
      });
      return jsonError("图卡生成失败，请稍后重试。", 502, "IMAGE_UPSTREAM_ERROR");
    }

    const url = data?.data?.[0]?.url;
    if (!url || !/^https:\/\//i.test(url)) {
      console.error("[generate-style-image] upstream returned no usable url", { status: upstream.status });
      return jsonError("图卡生成结果为空，请稍后重试。", 502, "IMAGE_EMPTY_RESULT");
    }

    return NextResponse.json({
      success: true,
      url,
      usedReference: Boolean(referenceImage),
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    console.error("[generate-style-image] request failed", {
      aborted,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError(
      aborted ? "图卡生成超时，请稍后重试。" : "图卡生成请求异常，请稍后重试。",
      aborted ? 504 : 500,
      aborted ? "IMAGE_TIMEOUT" : "IMAGE_REQUEST_FAILED",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/* 生产环境依赖                                                        */
/* ------------------------------------------------------------------ */

function readConfig(): StyleImageConfig {
  return {
    enabled: (process.env.DOUBAO_IMAGE_ENABLED ?? "true") !== "false",
    apiKey: process.env.DOUBAO_IMAGE_API_KEY ?? "",
    baseUrl: (process.env.DOUBAO_IMAGE_BASE_URL || process.env.DOUBAO_BASE_URL || DEFAULT_IMAGE_BASE_URL).replace(/\/+$/, ""),
    model: process.env.DOUBAO_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    size: process.env.DOUBAO_IMAGE_SIZE || DEFAULT_IMAGE_SIZE,
    timeoutMs: Number(process.env.DOUBAO_IMAGE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}

const defaultDeps: StyleImageDeps = {
  authenticate: async () => {
    const user = await verifyAuth();
    return user ? { uid: user.uid } : null;
  },
  loadDiagnosis: async (diagnosisId: string) => {
    const snapshot = await getAdminDb().collection("diagnoses").doc(diagnosisId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as DiagnosisSnapshot;
  },
  fetchImpl: (input, init) => fetch(input, init),
  config: readConfig(),
  now: () => Date.now(),
};

async function post(request: Request) {
  try {
    return await handleGenerateStyleImage(request, defaultDeps);
  } catch (error) {
    console.error("[generate-style-image] unhandled error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError("图卡生成服务异常，请稍后重试。", 500, "IMAGE_INTERNAL_ERROR");
  }
}

/**
 * Next.js App Router 要求路由文件只能导出 HTTP 方法与少量配置项（构建时会做
 * checkFields 类型校验），因此这里只导出 POST 与 runtime。
 *
 * 单元测试需要的可注入依赖入口挂在 POST 函数对象上（testHooks），
 * 它属于函数属性而非模块导出，不会影响路由文件的导出约束，
 * 同时让核心逻辑可以完全用 Mock 测试，不发起任何真实付费请求。
 */
export const POST = Object.assign(post, {
  testHooks: {
    handleGenerateStyleImage,
    describeHex,
    buildSubjectDescription,
    buildPrompt,
    normalizeReferenceImage,
    pickPalette,
    resolveDiagnosisStatus,
    resetStyleImageRateLimit,
  },
});
