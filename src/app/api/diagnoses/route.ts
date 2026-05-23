import { NextResponse } from "next/server";
import { SEASONS } from "@/lib/seasons";

export async function GET() {
  const season = SEASONS.spring;

  return NextResponse.json({
    success: true,
    data: [
      {
        id: "demo",
        season: "spring",
        created_at: new Date().toISOString(),
        thumbnail: season.palette,
      },
    ],
  });
}
