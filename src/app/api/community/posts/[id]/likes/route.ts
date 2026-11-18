import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getCommunityPostById, getPostLike, togglePostLike } from "@/lib/server/community";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const liked = await getPostLike(params.id, user.uid);
    return NextResponse.json({ success: true, liked });
  } catch (error) {
    console.error("[api/community/posts/:id/likes] load failed", {
      postId: params.id,
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const post = await getCommunityPostById(params.id);
    if (!post) {
      return NextResponse.json({ success: false, error: "POST_NOT_FOUND" }, { status: 404 });
    }

    const liked = await togglePostLike({
      postId: params.id,
      uid: user.uid,
      userEmail: user.email ?? "",
    });
    return NextResponse.json({ success: true, liked });
  } catch (error) {
    console.error("[api/community/posts/:id/likes] toggle failed", {
      postId: params.id,
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "TOGGLE_FAILED" }, { status: 500 });
  }
}
