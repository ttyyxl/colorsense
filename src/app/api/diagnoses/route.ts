import { NextResponse } from "next/server";
import { listDiagnoses } from "@/lib/diagnosis-store";
import { selectDiagnoses } from "@/lib/supabase-diagnoses";
import { isSupabaseAdminConfigured } from "@/lib/supabase-admin";

export async function GET() {
  const data = isSupabaseAdminConfigured() ? await selectDiagnoses() : listDiagnoses();

  return NextResponse.json({
    success: true,
    data,
  });
}
