import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { createCommunityPost, listCommunityPosts } from "@/lib/server/community";
import { getCommunityUserName } from "@/lib/community-types";

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

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const posts = await listCommunityPosts();
    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error("[api/community/posts] list failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
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

  const body = asRecord(payload);
  const content = asString(body.content);
  if (!content) {
    return NextResponse.json({ success: false, error: "CONTENT_REQUIRED" }, { status: 400 });
  }

  const email = user.email ?? asString(body.userEmail);
  const userName = asString(body.userName) || getCommunityUserName(email);

  try {
    const id = await createCommunityPost({
      uid: user.uid,
      userEmail: email,
      userName,
      content,
      ...(asString(body.seasonType) ? { seasonType: asString(body.seasonType) } : {}),
      tags: asStringList(body.tags),
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[api/community/posts] create failed", {
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}
