import { NextRequest, NextResponse } from "next/server";
import { generateDoubaoStyleAdvice } from "@/lib/ai";
import { buildDoubaoUserPrompt, DoubaoInferenceData } from "@/prompts/doubaoBuildPrompt";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as DoubaoInferenceData;

    // 校验必要参数
    if (!data.season || !data.lab_features) {
      return NextResponse.json(
        { success: false, error: "Missing required diagnosis data (season or lab_features)." },
        { status: 400 }
      );
    }

    console.info("[api/generate-style] Generating Doubao advice for:", data.season);

    const advice = await generateDoubaoStyleAdvice({
      season: data.season,
      confidence: data.confidence || 0.8,
      lab_features: data.lab_features,
      recommended_colors: data.recommended_colors || [],
      avoid_colors: data.avoid_colors || [],
      keywords: data.keywords || [],
    });

    return NextResponse.json({
      success: true,
      data: advice,
    });
  } catch (error) {
    console.error("[api/generate-style] Request failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during Doubao advice generation." },
      { status: 500 }
    );
  }
}