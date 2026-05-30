import { NextResponse } from "next/server";
import type { OutfitInspirationRequest } from "@/lib/outfit-types";
import { DOUBAO_OUTFIT_SYSTEM_PROMPT } from "@/prompts/doubaoOutfitSystemPrompt";
import { buildDoubaoOutfitUserPrompt } from "@/prompts/buildDoubaoOutfitPrompt";
import { OutfitAiOutputSchema, OutfitAiOutput } from "@/lib/outfit-ai-types";
import OpenAI from "openai";

export const runtime = "nodejs";

// --- 类型安全工具 ---
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

// --- 请求规范化 ---
function normalizeRequest(payload: unknown): OutfitInspirationRequest {
  const root = asRecord(payload);
  const profile = asRecord(root.profile);
  const weather = asRecord(root.weather);
  const scene = asString(root.scene);

  return {
    season: asString(root.season),
    profile: {
      favoriteColors: asStringList(profile.favoriteColors),
      stylePreferences: asStringList(profile.stylePreferences),
      makeupPreference: asString(profile.makeupPreference),
    },
    scene: scene === "travel" ? "travel" : "daily",
    occasion: asString(root.occasion),
    mood: asString(root.mood),
    weather:
      Object.keys(weather).length > 0
        ? {
            city: asString(weather.city),
            temperature: asString(weather.temperature),
            condition: asString(weather.condition),
          }
        : null,
  };
}

// --- 请求校验 ---
function validateRequest(input: OutfitInspirationRequest) {
  if (!input.season) return "SEASON_REQUIRED";
  if (!input.occasion) return "OCCASION_REQUIRED";
  if (!input.mood) return "MOOD_REQUIRED";
  return null;
}

// --- Doubao API 配置 ---
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL;
const DOUBAO_MODEL = process.env.DOUBAO_MODEL;

// --- Fallback 输出 ---
const FALLBACK_RESULT: OutfitAiOutput & { source: "fallback" } = {
  theme: "Fallback Theme",
  color_palette: ["#CCCCCC", "#AAAAAA", "#888888", "#666666", "#444444", "#222222"],
  item_recommendations: {
    top: "Fallback Top",
    bottom: "Fallback Bottom",
    outerwear: "Fallback Outerwear",
    shoes: "Fallback Shoes",
    bag: "Fallback Bag",
    accessories: "Fallback Accessories",
  },
  makeup_advice: "Fallback Makeup",
  reason: "Fallback Reason",
  source: "fallback",
};

// --- Doubao 调用 ---
async function generateDoubaoOutfitAdvice(
  input: OutfitInspirationRequest
): Promise<OutfitAiOutput & { source: "doubao" | "fallback" }> {
  if (!DOUBAO_API_KEY || !DOUBAO_BASE_URL || !DOUBAO_MODEL) {
    console.error("Doubao API keys are not configured");
    return FALLBACK_RESULT;
  }

  const openai = new OpenAI({
    apiKey: DOUBAO_API_KEY,
    baseURL: DOUBAO_BASE_URL,
  });

  const userPrompt = buildDoubaoOutfitUserPrompt(input);
  console.log("[doubao-outfit-request]", userPrompt);

  try {
    const response = await openai.chat.completions.create({
      model: DOUBAO_MODEL,
      messages: [
        { role: "system", content: DOUBAO_OUTFIT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    console.log("[doubao-outfit-response]", content);

    if (!content) {
      console.error("[doubao-outfit-service] Doubao API returned empty content");
      return FALLBACK_RESULT;
    }

    try {
      const cleanJson = content.replace(/```json\n?|\\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const validatedOutput = OutfitAiOutputSchema.parse(parsed);
      return { ...validatedOutput, source: "doubao" };
    } catch (parseError) {
      console.error("[doubao-outfit-service] JSON parse/validation failed", parseError, content);
      return FALLBACK_RESULT;
    }
  } catch (error) {
    console.error("[doubao-outfit-service] Doubao API call failed", error);
    return FALLBACK_RESULT;
  }
}

// --- POST 处理 ---
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const input = normalizeRequest(payload);
  const validationError = validateRequest(input);
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
  }

  console.info("[outfit-inspiration] request validated", {
    season: input.season,
    scene: input.scene,
    occasion: input.occasion,
    mood: input.mood,
  });

  const result = await generateDoubaoOutfitAdvice(input);

  // --- 成功或失败区分 ---
  if (result.source === "doubao") {
    return NextResponse.json({
      success: true,
      data: result,
      source: "doubao",
    });
  } else {
    return NextResponse.json({
      success: false,
      error: "AI_GENERATION_FAILED",
      data: result,
      source: "fallback",
    });
  }
}