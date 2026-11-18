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
    return NextResponse.json({ success: true, diagnoses });
  } catch (error) {
    console.error("[api/diagnoses] list failed", {
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
}
