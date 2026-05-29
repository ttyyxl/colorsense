import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function toIsoString(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    const timestamp = value as { toDate?: () => Date };
    return timestamp.toDate?.().toISOString() ?? null;
  }
  return typeof value === "string" ? value : null;
}

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const db = getAdminDb();
  const snapshot = await db.collection("diagnoses").where("userId", "==", user.uid).get();
  const diagnoses = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        seasonType: data.seasonType ?? null,
        confidence: typeof data.confidence === "number" ? data.confidence : null,
        source: data.source ?? null,
        createdAt: toIsoString(data.createdAt),
      };
    })
    .sort((left, right) => getTime(right.createdAt) - getTime(left.createdAt));

  return NextResponse.json({
    success: true,
    diagnosis: diagnoses[0] ?? null,
  });
}

function getTime(value: string | null) {
  if (!value) {
    return 0;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}
