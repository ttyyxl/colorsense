import { NextResponse } from "next/server";
export function POST() {
  return NextResponse.json({ success: false, error: "结果邮件发送功能已废弃，请使用结果页下载 PNG。" }, { status: 410 });
}
