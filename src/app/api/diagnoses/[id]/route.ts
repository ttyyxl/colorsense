import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ success: false, error: "该接口已废弃，诊断结果现由 Firestore 提供。" }, { status: 410 });
}
