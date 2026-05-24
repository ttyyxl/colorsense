import { NextResponse } from "next/server";
import { getDiagnosis } from "@/lib/diagnosis-store";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = context.params;
  const diagnosis = getDiagnosis(id);

  if (!diagnosis) {
    return NextResponse.json({ success: false, error: "没有找到这次诊断记录，请重新上传照片。" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: diagnosis });
}
