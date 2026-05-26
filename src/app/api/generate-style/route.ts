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

    // 构建 Prompt
    const userPrompt = buildDoubaoUserPrompt(data);

    // 调用豆包模型
    const advice = await generateDoubaoStyleAdvice(userPrompt);

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
