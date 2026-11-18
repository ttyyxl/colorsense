import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAccountProfile, saveAccountProfile } from "@/lib/server/user-profiles";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const profile = await getAccountProfile(user.uid);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("[api/account-profile] load failed", {
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
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
    return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const body = asRecord(payload);
  const nickname = asString(body.nickname);
  if (!nickname) {
    return NextResponse.json({ success: false, error: "NICKNAME_REQUIRED" }, { status: 400 });
  }

  const email = user.email ?? asString(body.email);

  try {
    await saveAccountProfile(user.uid, email, nickname);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/account-profile] save failed", {
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "SAVE_FAILED" }, { status: 500 });
  }
}
