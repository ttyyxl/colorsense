import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { saveColorCardTest } from "@/lib/server/user-profiles";
import {
  COLOR_CARDS,
  isSeasonKey,
  summarizeColorCardSelections,
  type ColorCardSelection,
} from "@/lib/color-card";

export const runtime = "nodejs";

function parseSelections(payload: unknown): { selections: ColorCardSelection[] } | { error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { error: "VALIDATION_ERROR" };
  }
  const raw = (payload as { selections?: unknown }).selections;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > COLOR_CARDS.length) {
    return { error: "VALIDATION_ERROR" };
  }

  const allowedCards = new Set(COLOR_CARDS.map((card) => card.id));
  const seen = new Set<string>();
  const selections: ColorCardSelection[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      return { error: "VALIDATION_ERROR" };
    }
    const { cardId, season } = item as { cardId?: unknown; season?: unknown };
    if (typeof cardId !== "string" || !allowedCards.has(cardId) || seen.has(cardId) || !isSeasonKey(season)) {
      return { error: "VALIDATION_ERROR" };
    }
    seen.add(cardId);
    selections.push({ cardId, season });
  }

  return { selections };
}

export async function PUT(request: Request) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const parsed = parseSelections(payload);
  if ("error" in parsed) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  const result = {
    seasons: summarizeColorCardSelections(parsed.selections),
    selections: parsed.selections,
    completedAt: new Date().toISOString(),
  };

  try {
    await saveColorCardTest(user.uid, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "PROFILE_NOT_FOUND" }, { status: 409 });
    }
    console.error("[color-card-test] save failed", { message });
    return NextResponse.json({ success: false, error: "SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ success: true, result });
}
