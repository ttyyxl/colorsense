import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { listUserDiagnoses } from "@/lib/server/diagnoses";

export const runtime = "nodejs";

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const diagnoses = await listUserDiagnoses(user.uid);
    const latest = diagnoses[0];
    return NextResponse.json({
      success: true,
      diagnosis: latest
        ? {
            id: latest.id,
            seasonType: latest.seasonType,
            confidence: latest.confidence,
            source: latest.source ?? null,
            createdAt: latest.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[api/user-profile/latest-diagnosis] load failed", {
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
}
