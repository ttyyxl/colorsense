import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ success: false, error: "该接口已废弃，请使用 Firebase Authentication 登录。" }, { status: 410 });
}
