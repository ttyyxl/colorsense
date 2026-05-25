import { NextResponse } from "next/server";
export function POST() {
  return NextResponse.json({ success: false, error: "该注册接口已废弃，请使用 Firebase 注册流程。" }, { status: 410 });
}
