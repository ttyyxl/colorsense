import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { deleteUserDiagnosis, getUserDiagnosis } from "@/lib/server/diagnoses";

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
    const diagnosis = await getUserDiagnosis(params.id, user.uid);
    if (!diagnosis) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ success: true, diagnosis });
  } catch (error) {
    console.error("[api/diagnoses/:id] load failed", {
      diagnosisId: params.id,
      userId: user.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const diagnosisId = params.id;
  const user = await verifyAuth();

  if (!user) {
    console.warn("[diagnosis-delete] Unauthorized delete request", { diagnosisId });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const diagnosis = await getUserDiagnosis(diagnosisId, user.uid);
    if (!diagnosis) {
      return NextResponse.json({ success: false, error: "Diagnosis not found" }, { status: 404 });
    }

    // 当前诊断记录不存储上传图片或子集合，删除范围仅限该行记录。
    await deleteUserDiagnosis(diagnosisId, user.uid);

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
