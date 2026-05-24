import { NextResponse } from "next/server";
import { listDiagnoses } from "@/lib/diagnosis-store";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: listDiagnoses(),
  });
}
