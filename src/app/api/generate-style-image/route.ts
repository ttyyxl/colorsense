import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DOUBAO_API_KEY =
  process.env.DOUBAO_IMAGE_API_KEY ||
  process.env.DOUBAO_API_KEY ||
  "ark-df3720c0-0027-4cf1-9535-793826c8f74e-6aa66";
const DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const IMAGE_MODEL = "doubao-seedream-5-0-flash-260915";

interface GenerateStyleImageRequest {
  colors: string[];
  season?: string;
  labFeatures?: { L: number; a: number; b: number };
  /** 参考图：可以是公网 URL，也可以是 base64 data URL（data:image/...;base64,xxx） */
  image?: string;
}

/**
 * 将 hex 色值转换成更贴近自然语言的颜色描述，便于文生图模型理解。
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
function buildSubjectDescription(season?: string, lab?: { L: number; a: number; b: number }): string {
  let skinDesc = "自然真实的亚洲肤色";
  if (lab) {
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

function buildPrompt(
  colors: string[],
  season?: string,
  lab?: { L: number; a: number; b: number },
  hasImage = false
): string {
  const palette = colors.slice(0, 6);
  while (palette.length < 6) palette.push(palette[palette.length - 1] || "#C0C0C0");

  const colorList = palette
    .map((c, i) => `第 ${i + 1} 张：上身穿着纯色 ${describeHex(c)} 的圆领内搭，外搭同色西装外套`)
    .join("；");

  const subject = buildSubjectDescription(season, lab);

  const base = [
    "一张横向排版的高端时尚「服装颜色模拟」图卡，画面从左到右均匀排列六张等宽竖版半身肖像，六张肖像必须是同一个人物，姿势、表情、发型、五官脸型、肤色完全一致，只有上身外套颜色不同。",
    subject,
    colorList + "。",
    "人物正面朝向镜头，肩部以上入镜，内搭为同色的圆领打底衫（圆领、纯色），外搭合身的同色西装/夹克外套，内外同色，版型简洁、干净利落。",
    "严格要求：内搭与外搭必须是同一种单一纯色，整套服装只使用这一种颜色，严禁出现任何图案、印花、logo、字母、条纹、格纹、波点、拼接、撞色、渐变、反光或第二种颜色；画面中除人物自然的肤色、发色、浅灰纯色背景与这套单一纯色服装（同色圆领内搭＋同色外套）外，不得出现其他杂色衣物。",
    "纯净浅灰影棚背景，柔和均匀的自然光，专业肖像摄影，杂志大片质感，画面整体干净、高级、极简。",
    "画面左上角有标题文字「服装颜色模拟」，右上角有小字英文「DIFFERENT COLORS / DIFFERENT VIBES」，每张肖像下方有一个对应外套颜色的小圆点色卡和颜色名称标签。",
  ];

  if (hasImage) {
    base.push(
      "重要：必须严格保留参考图中人物的五官、脸型、发型、肤色与气质，不要换脸，不要改变任何面部特征；只保留面部与头发，把身上的衣服全部替换为上述对应的单一纯色套装（同色圆领内搭＋同色外套），不要沿用参考图中原有的服装颜色、图案、花纹或配饰，像同一张照片只把衣服换成了纯色。不要过度磨皮或美颜，保留真实皮肤质感。"
    );
  } else {
    base.push(
      "重要：六张脸必须完全一样，像同一张照片只换了纯色衣服，不要换脸，不要改变五官，衣服必须是单一纯色（同色圆领内搭＋同色外套）、不得出现任何图案或第二种颜色，不要美颜过度，保持真实皮肤质感。"
    );
  }

  return base.join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as GenerateStyleImageRequest | null;
    if (!body || !Array.isArray(body.colors) || body.colors.length === 0) {
      return NextResponse.json(
        { success: false, error: "缺少 colors 参数" },
        { status: 400 }
      );
    }

    const hasImage = Boolean(body.image);
    const prompt = buildPrompt(body.colors, body.season, body.labFeatures, hasImage);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    const requestBody: Record<string, unknown> = {
      model: IMAGE_MODEL,
      prompt,
      response_format: "url",
      size: "2K",
      ratio: "16:9",
      stream: false,
      watermark: false,
    };
    if (hasImage) {
      requestBody.image = body.image;
    }

    const resp = await fetch(`${DOUBAO_BASE_URL.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[generate-style-image] API error:", data);
      return NextResponse.json(
        { success: false, error: data?.error?.message || "图片生成失败，请稍后重试" },
        { status: 502 }
      );
    }

    const url: string | undefined = data?.data?.[0]?.url;
    if (!url) {
      console.error("[generate-style-image] no url in response:", data);
      return NextResponse.json(
        { success: false, error: "图片生成返回为空，请稍后重试" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("[generate-style-image] failed:", error);
    return NextResponse.json(
      { success: false, error: "图片生成请求异常，请稍后重试" },
      { status: 500 }
    );
  }
}
