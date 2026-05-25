import { NextResponse } from "next/server";
import { SEASONS } from "@/lib/seasons";
import type { SeasonType } from "@/lib/seasons";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

interface InferenceResponse {
  season: SeasonType;
  confidence: number;
  source?: "fastapi" | "mock";
  scores?: Partial<Record<SeasonType, number>>;
  lab_features?: {
    L: number;
    a: number;
    b: number;
  };
}

function pickFallbackSeason(file: File): InferenceResponse {
  const seasons: SeasonType[] = ["spring", "summer", "autumn", "winter"];
  const seed = [...file.name].reduce((sum, char) => sum + char.charCodeAt(0), file.size);
  const season = seasons[seed % seasons.length];

  return {
    season,
    confidence: 0.72,
    source: "mock",
    scores: {
      spring: season === "spring" ? 0.72 : 0.09,
      summer: season === "summer" ? 0.72 : 0.09,
      autumn: season === "autumn" ? 0.72 : 0.09,
      winter: season === "winter" ? 0.72 : 0.09,
    },
    lab_features: {
      L: 65,
      a: 8,
      b: 12,
    },
  };
}

async function runInference(file: File): Promise<InferenceResponse> {
  const inferenceUrl = process.env.INFERENCE_SERVICE_URL;

  if (!inferenceUrl) {
    return pickFallbackSeason(file);
  }

  try {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${inferenceUrl.replace(/\/$/, "")}/diagnose`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return pickFallbackSeason(file);
    }

    return { ...((await response.json()) as InferenceResponse), source: "fastapi" };
  } catch {
    return pickFallbackSeason(file);
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ success: false, error: "请上传一张正面照。" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(image.type)) {
    return NextResponse.json({ success: false, error: "仅支持 JPG、PNG、HEIC 或 WebP 图片。" }, { status: 400 });
  }

  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json({ success: false, error: "图片不能超过 10MB，请压缩后重试。" }, { status: 400 });
  }

  const inference = await runInference(image);
  const season = SEASONS[inference.season] ?? SEASONS.spring;
  const diagnosis = {
    seasonType: inference.season,
    confidence: inference.confidence,
    colorPalette: season.palette,
    styleKeywords: season.keywords,
    avoidColors: season.avoid,
    aiDescription: season.styleDesc,
    labFeatures: inference.lab_features ?? { L: 65, a: 8, b: 12 },
    source: inference.source ?? "mock",
    scores: inference.scores,
  };

  return NextResponse.json({
    success: true,
    data: diagnosis,
  });
}
