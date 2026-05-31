import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { createUserOutfitRecord, listUserOutfitRecords } from "@/lib/firestore-outfit-records";
import type { OutfitInspirationRequest, OutfitInspirationResult } from "@/lib/outfit-types";

export const runtime = "nodejs";

function asRecord(value: unknown) {
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
  const request = asRecord(root.request);
  const profile = asRecord(request.profile);
  const weather = asRecord(request.weather);

  return {
    season: asString(request.season),
    profile: {
      favoriteColors: asStringList(profile.favoriteColors),
      stylePreferences: asStringList(profile.stylePreferences),
      makeupPreference: asString(profile.makeupPreference),
    },
    scene: request.scene === "travel" ? "travel" : "daily",
    occasion: asString(request.occasion),
    mood: asString(request.mood),
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

function normalizeResult(payload: unknown): OutfitInspirationResult {
  const root = asRecord(payload);
  const result = asRecord(root.result);
  const palette = asStringList(result.color_palette);
  const items = asRecord(result.item_recommendations);

  return {
    theme: asString(result.theme),
    color_palette: palette,
    item_recommendations: {
      top: asString(items.top),
      bottom: asString(items.bottom),
      outerwear: asString(items.outerwear),
      shoes: asString(items.shoes),
      bag: asString(items.bag),
      accessories: asString(items.accessories),
    },
    makeup_advice: asString(result.makeup_advice),
    reason: asString(result.reason),
  };
}

function asImageUrl(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const records = await listUserOutfitRecords(user.uid);
  return NextResponse.json({ success: true, records });
}

export async function POST(request: Request) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const recordRequest = normalizeRequest(payload);
  const recordResult = normalizeResult(payload);
  const source = asRecord(payload).source === "mock" ? "mock" : "ai";
  const imageUrl = asImageUrl(asRecord(payload).imageUrl);

  if (!recordRequest.season || !recordRequest.occasion || !recordRequest.mood || !recordResult.theme) {
    return NextResponse.json({ success: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const id = await createUserOutfitRecord(user.uid, {
    request: recordRequest,
    result: recordResult,
    source,
    ...(imageUrl ? { imageUrl } : {}),
  });

  return NextResponse.json({ success: true, id });
}
