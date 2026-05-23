import { NextResponse } from "next/server";
import { SEASONS } from "@/lib/seasons";

export async function POST() {
  const season = SEASONS.spring;

  return NextResponse.json({
    success: true,
    data: {
      diagnosis_id: "demo",
      season: "spring",
      confidence: 0.89,
      palette: season.palette,
      keywords: season.keywords,
      ai_description: season.styleDesc,
    },
  });
}
