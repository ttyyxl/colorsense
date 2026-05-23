import { NextResponse } from "next/server";
import { SEASONS } from "@/lib/seasons";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = context.params;
  const season = SEASONS.spring;

  return NextResponse.json({
    success: true,
    data: {
      id,
      season_type: "spring",
      confidence: 0.89,
      color_palette: season.palette,
      style_keywords: season.keywords,
      ai_description: season.styleDesc,
      lab_features: { L: 72, a: 10, b: 15 },
    },
  });
}
