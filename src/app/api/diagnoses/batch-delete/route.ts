import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

const MAX_BATCH_SIZE = 500;

interface BatchDeleteRequest {
  ids?: unknown;
}

interface FailedDelete {
  id: string;
  reason: "not_found" | "forbidden" | "invalid_id" | "delete_failed";
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

  console.info("[diagnosis-batch-delete] Batch delete request started", {
    userId: user.uid,
    requestedCount: ids.length,
  });

  const db = getAdminDb();
  const failed: FailedDelete[] = [];
  const deletableRefs: FirebaseFirestore.DocumentReference[] = [];

  try {
    for (const idGroup of chunk(ids, MAX_BATCH_SIZE)) {
      const refs = idGroup.map((id) => db.collection("diagnoses").doc(id));
      const snapshots = await db.getAll(...refs);

      snapshots.forEach((snapshot, index) => {
        const id = idGroup[index];

        if (!snapshot.exists) {
          failed.push({ id, reason: "not_found" });
          return;
        }

        const data = snapshot.data();
        if (data?.userId !== user.uid) {
          failed.push({ id, reason: "forbidden" });
          return;
        }

        deletableRefs.push(snapshot.ref);
      });
    }

    // Current diagnosis records do not store uploaded images, Storage URLs, or subcollections.
    // Batch cleanup therefore deletes only diagnoses/{diagnosisId} documents. If images or
    // child collections are added later, clean them before or inside this loop.
    for (const refGroup of chunk(deletableRefs, MAX_BATCH_SIZE)) {
      const batch = db.batch();
      refGroup.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    const deletedIds = deletableRefs.map((ref) => ref.id);

    console.info("[diagnosis-batch-delete] Batch delete request completed", {
      userId: user.uid,
      requestedCount: ids.length,
      deletedCount: deletedIds.length,
      failedCount: failed.length,
      failedReasons: failed.reduce<Record<string, number>>((acc, item) => {
        acc[item.reason] = (acc[item.reason] ?? 0) + 1;
        return acc;
      }, {}),
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
      deletedCount: deletableRefs.length,
      failedCount: failed.length,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Batch delete failed", deletedIds: [], failed }, { status: 500 });
  }
}
