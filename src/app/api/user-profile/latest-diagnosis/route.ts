import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { listUserDiagnoses } from "@/lib/server/diagnoses";
import { isExecutableDiagnosisStatus, resolveDiagnosisStatusOf } from "@/lib/diagnosis-status";

export const runtime = "nodejs";

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const diagnoses = await listUserDiagnoses(user.uid);
    const latest = diagnoses
      .map((diagnosis) => ({
        diagnosis,
        status: resolveDiagnosisStatusOf(diagnosis),
      }))
      .find(({ status }) => isExecutableDiagnosisStatus(status));

    return NextResponse.json({
      success: true,
      diagnosis: latest
        ? {
            id: latest.diagnosis.id,
            seasonType: latest.diagnosis.seasonType,
            confidence: latest.diagnosis.confidence,
            source: latest.diagnosis.source,
            diagnosisStatus: latest.status,
            createdAt: latest.diagnosis.createdAt,
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
