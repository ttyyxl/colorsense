import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export function GET() {
  return NextResponse.json(
    { success: false, error: "This endpoint is deprecated. Diagnosis results are provided by Firestore." },
    { status: 410 },
  );
}

interface RouteContext {
  params: {
    id: string;
  };
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const diagnosisId = params.id;
  const user = await verifyAuth();

  if (!user) {
    console.warn("[diagnosis-delete] Unauthorized delete request", { diagnosisId });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  console.info("[diagnosis-delete] Delete request started", {
    diagnosisId,
    userId: user.uid,
  });

  try {
    const docRef = getAdminDb().collection("diagnoses").doc(diagnosisId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      console.warn("[diagnosis-delete] Diagnosis not found", {
        diagnosisId,
        userId: user.uid,
      });
      return NextResponse.json({ success: false, error: "Diagnosis not found" }, { status: 404 });
    }

    const data = snapshot.data();
    if (data?.userId !== user.uid) {
      console.warn("[diagnosis-delete] Forbidden delete attempt", {
        diagnosisId,
        userId: user.uid,
        ownerMatches: false,
      });
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Current diagnosis records do not store uploaded images or subcollections.
    // Deletion scope is therefore limited to the Firestore document itself.
    await docRef.delete();

    console.info("[diagnosis-delete] Delete request succeeded", {
      diagnosisId,
      userId: user.uid,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[diagnosis-delete] Delete request failed", {
      diagnosisId,
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  }
}
