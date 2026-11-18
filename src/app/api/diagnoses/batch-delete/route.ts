import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { deleteUserDiagnoses } from "@/lib/server/diagnoses";

export const runtime = "nodejs";

const MAX_BATCH_SIZE = 500;

interface BatchDeleteRequest {
  ids?: unknown;
}

export async function POST(request: Request) {
  const user = await verifyAuth();

  if (!user) {
    console.warn("[diagnosis-batch-delete] Unauthorized batch delete request");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: BatchDeleteRequest;
  try {
    payload = (await request.json()) as BatchDeleteRequest;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(payload.ids)
    ? [...new Set(payload.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: "No diagnosis ids provided" }, { status: 400 });
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ success: false, error: "Too many ids provided" }, { status: 400 });
  }

  try {
    const { deletedIds, failed } = await deleteUserDiagnoses(ids, user.uid);

    console.info("[diagnosis-batch-delete] Batch delete request completed", {
      userId: user.uid,
      requestedCount: ids.length,
      deletedCount: deletedIds.length,
      failedCount: failed.length,
    });

    return NextResponse.json({
      success: failed.length === 0,
      deletedIds,
      failed,
      deletedCount: deletedIds.length,
      failedCount: failed.length,
    });
  } catch (error) {
    console.error("[diagnosis-batch-delete] Batch delete request failed", {
      userId: user.uid,
      requestedCount: ids.length,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Batch delete failed", deletedIds: [], failed: [] }, { status: 500 });
  }
}
