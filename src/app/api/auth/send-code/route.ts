import { NextResponse } from "next/server";
export function POST() {
  return NextResponse.json({ success: false, error: "该验证码接口已废弃，请使用 Firebase 邮箱验证流程。" }, { status: 410 });
}
