import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { createPostComment, getCommunityPostById, listPostComments } from "@/lib/server/community";
import { getCommunityUserName } from "@/lib/community-types";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const comments = await listPostComments(params.id);
    return NextResponse.json({ success: true, comments });
  } catch (error) {
    console.error("[api/community/posts/:id/comments] list failed", {
      postId: params.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
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
    return NextResponse.json({ success: false, error: "COMMENT_CONTENT_REQUIRED" }, { status: 400 });
  }

  try {
    const post = await getCommunityPostById(params.id);
    if (!post) {
      return NextResponse.json({ success: false, error: "POST_NOT_FOUND" }, { status: 404 });
    }

    const email = user.email ?? asString(body.userEmail);
    const id = await createPostComment(params.id, {
      uid: user.uid,
      userEmail: email,
      userName: asString(body.userName) || getCommunityUserName(email),
      content,
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[api/community/posts/:id/comments] create failed", {
      postId: params.id,
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}
