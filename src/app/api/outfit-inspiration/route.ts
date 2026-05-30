import { NextResponse } from "next/server";
import { buildMockOutfit, buildOutfitPrompt } from "@/lib/outfit-prompt";
import type { OutfitInspirationRequest } from "@/lib/outfit-types";

export const runtime = "nodejs";

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

function validateRequest(input: OutfitInspirationRequest) {
  if (!input.season) {
    return "SEASON_REQUIRED";
  }
  if (!input.occasion) {
    return "OCCASION_REQUIRED";
  }
  if (!input.mood) {
    return "MOOD_REQUIRED";
  }
  return null;
}

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

  const prompt = buildOutfitPrompt(input);
  console.info("[outfit-inspiration] prompt prepared", {
    promptLength: prompt.length,
    season: input.season,
    scene: input.scene,
    occasion: input.occasion,
  });

  // TODO: Call the real AI provider here and validate the fixed JSON result.
  // The mock keeps the page usable when the AI API is not configured.
  return NextResponse.json({
    success: true,
    data: buildMockOutfit(input),
    source: "mock",
  });
}
