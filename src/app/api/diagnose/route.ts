import { NextResponse } from "next/server";
import { SEASONS } from "@/lib/seasons";
import type { SeasonType } from "@/lib/seasons";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateAiAdvice } from "@/lib/claude";
import { buildUserPrompt } from "@/prompts/buildPrompt";
import { generateDoubaoStyleAdvice } from "@/lib/ai";
import { buildDoubaoUserPrompt } from "@/prompts/doubaoBuildPrompt";
import { GeminiInferenceData } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const INFERENCE_TIMEOUT_MS = 60_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

class InferenceTimeoutError extends Error {
  constructor() {
    super("AI inference timed out. Please try again with a smaller image.");
    this.name = "InferenceTimeoutError";
  }
}

interface InferenceResponse {
  season: string;
  confidence: number;
  source?: "model" | "rules";
  scores?: Partial<Record<SeasonType, number>>;
  lab_features?: {
    L: number;
    a: number;
    b: number;
  };
}

async function runInference(file: File): Promise<InferenceResponse> {
  const inferenceUrl = process.env.INFERENCE_SERVICE_URL;

  if (!inferenceUrl) {
    throw new Error("Inference service is not configured.");
  }

  let response: Response;
  const startedAt = Date.now();
  console.info("[diagnose-debug] FastAPI request start", {
    inferenceServiceUrlPresent: true,
    timeoutMs: INFERENCE_TIMEOUT_MS,
  });

  try {
    const formData = new FormData();
    formData.append("image", file);

    response = await fetch(`${inferenceUrl.replace(/\/$/, "")}/diagnose`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error("[diagnose-debug] FastAPI request failed", {
      durationMs,
      message: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new InferenceTimeoutError();
    }
    throw new Error("Inference service is unavailable. Please try again.");
  }

  console.info("[diagnose-debug] FastAPI response", {
    status: response.status,
    durationMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? "诊断失败，请重新选择清晰的正面照。");
  }

  const payload = (await response.json()) as InferenceResponse;
  console.info("[diagnose-debug] FastAPI payload", {
    keys: Object.keys(payload),
  });
  return payload;
}

function isSeasonType(value: string): value is SeasonType {
  return value in SEASONS;
}

export async function POST(request: Request) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "请先登录后再开始诊断。" }, { status: 401 });
  }

  const canUseDiagnosisFeatures = user.email_verified === true || user.firebase?.sign_in_provider === "google.com";
  if (!canUseDiagnosisFeatures) {
    return NextResponse.json({ success: false, error: "Please verify your email before starting a diagnosis." }, { status: 403 });
  }

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

  try {
    const inference = await runInference(image);
    if (!isSeasonType(inference.season)) {
      throw new Error("Inference service returned an unsupported season.");
    }

    const season = SEASONS[inference.season];
    const diagnosis = {
      seasonType: inference.season,
      confidence: inference.confidence,
      colorPalette: season.palette,
      styleKeywords: season.keywords,
      avoidColors: season.avoid,
      aiDescription: season.styleDesc,
      labFeatures: inference.lab_features ?? { L: 65, a: 8, b: 12 },
      source: inference.source ?? "rules",
      scores: inference.scores,
    };
    const { scores, ...requiredDiagnosisFields } = diagnosis;

    // 生成 AI 建议
    console.info("[diagnose-debug] Generating AI advice...");
    const aiUserPrompt = buildUserPrompt({
      seasonType: diagnosis.seasonType as SeasonType,
      confidence: diagnosis.confidence,
      labFeatures: diagnosis.labFeatures,
      styleKeywords: diagnosis.styleKeywords,
    });
    const aiAdvice = await generateAiAdvice(aiUserPrompt);

    // 生成豆包大模型建议
    console.info("[diagnose-debug] Generating Doubao style advice...");
    const doubaoAdvice = await generateDoubaoStyleAdvice(
      buildDoubaoUserPrompt({
        season: inference.season,
        confidence: inference.confidence,
        lab_features: diagnosis.labFeatures,
        recommended_colors: diagnosis.colorPalette.slice(0, 3),
        avoid_colors: diagnosis.avoidColors.slice(0, 2),
        keywords: diagnosis.styleKeywords,
        style_desc: diagnosis.aiDescription,
      })
    ).catch(() => undefined);

    let diagnosisId: string;
    try {
      const docRef = await getAdminDb().collection("diagnoses").add({
        ...requiredDiagnosisFields,
        ...(scores === undefined ? {} : { scores }),
        aiAdvice,
        doubaoAdvice, // 存储豆包建议
        userId: user.uid,
        createdAt: new Date(),
      });
      diagnosisId = docRef.id;
      console.info("[diagnose-debug] Firestore write", {
        succeeded: true,
        diagnosisIdPresent: Boolean(diagnosisId),
      });
    } catch (error) {
      console.error("[diagnose-debug] Firestore write failed", {
        succeeded: false,
        diagnosisIdPresent: false,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ success: false, error: "Failed to save the diagnosis result. Please try again." }, { status: 500 });
    }

    const finalPayload = {
      success: true,
      diagnosisId,
      data: {
        ...diagnosis,
        aiAdvice,
        doubaoAdvice,
      },
    };
    console.info("[diagnose-debug] Final response", {
      keys: Object.keys(finalPayload),
      diagnosisIdPresent: Boolean(diagnosisId),
    });
    return NextResponse.json(finalPayload);
  } catch (error) {
    if (error instanceof InferenceTimeoutError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 504 });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "诊断失败，请稍后重试。" },
      { status: 422 },
    );
  }
}
