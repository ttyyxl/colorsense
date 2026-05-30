import { NextResponse } from "next/server";
import { SEASONS } from "@/lib/seasons";
import type { SeasonType } from "@/lib/seasons";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateDoubaoStyleAdvice } from "@/lib/ai";
import type { DiagnosisQuality } from "@/lib/types";
import { getUserProfile } from "@/lib/firestore-user-profiles";
import { buildUserProfilePromptContext } from "@/lib/user-profile-summary";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const INFERENCE_TIMEOUT_MS = 60_000;
const MIN_FACE_CONFIDENCE = 0.8;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const NO_CLEAR_FACE_MESSAGE = "未检测到清晰人脸，请在自然光下重新上传或拍摄正面人像照片。";

class InferenceTimeoutError extends Error {
  constructor() {
    super("AI inference timed out. Please try again with a smaller image.");
    this.name = "InferenceTimeoutError";
  }
}

class NoClearFaceError extends Error {
  quality: DiagnosisQuality;
  constructor(message: string, quality: DiagnosisQuality) {
    super(message);
    this.name = "NoClearFaceError";
    this.quality = quality;
  }
}

class ModelUnavailableError extends Error {
  constructor(message = "模型服务暂时不可用，请稍后重试。") {
    super(message);
    this.name = "ModelUnavailableError";
  }
}

interface InferenceResponse {
  season: string;
  confidence: number;
  source?: "model" | "rules";
  scores?: Partial<Record<SeasonType, number>>;
  lab_features?: { L: number; a: number; b: number };
  faceDetected?: boolean;
  usedOriginalImage?: boolean;
  face_confidence?: number;
  quality?: Partial<DiagnosisQuality>;
}

async function runInference(file: File): Promise<InferenceResponse> {
  const inferenceUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.INFERENCE_SERVICE_URL;
  if (!inferenceUrl) {
    throw new Error("Inference service is not configured.");
  }

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${inferenceUrl.replace(/\/$/, "")}/diagnose`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 422 && payload.error === "NO_CLEAR_FACE") {
      throw new NoClearFaceError(
        payload.message ?? NO_CLEAR_FACE_MESSAGE,
        payload.quality ?? { faceDetected: false, usedOriginalImage: true, faceConfidence: 0 }
      );
    }
    if (response.status === 503 && payload.code === "MODEL_UNAVAILABLE") {
      throw new ModelUnavailableError(payload.message);
    }
    throw new Error(payload.detail ?? payload.message ?? "诊断失败，请重新选择清晰的正面照。");
  }

  return await response.json();
}

function isSeasonType(value: string): value is SeasonType {
  return value in SEASONS;
}

export async function POST(request: Request) {
  // 1. 验证用户
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "请先登录后再开始诊断。" }, { status: 401 });
  }

  const canUseDiagnosisFeatures = user.email_verified === true || user.firebase?.sign_in_provider === "google.com";
  if (!canUseDiagnosisFeatures) {
    return NextResponse.json({ success: false, error: "请先验证邮箱后再进行诊断。" }, { status: 403 });
  }

  // 2. 验证图片
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
    // 3. 调用推理服务
    const inference = await runInference(image);

    if (inference.source !== "model") {
      throw new ModelUnavailableError();
    }

    // 4. 验证人脸检测结果
    const faceDetected = inference.quality?.faceDetected ?? inference.faceDetected;
    const usedOriginalImage = inference.quality?.usedOriginalImage ?? inference.usedOriginalImage;
    const faceConfidence = inference.quality?.faceConfidence ?? inference.face_confidence;
    
    if (faceDetected !== true || usedOriginalImage !== false || 
        typeof faceConfidence !== "number" || faceConfidence < MIN_FACE_CONFIDENCE) {
      throw new NoClearFaceError(NO_CLEAR_FACE_MESSAGE, {
        faceDetected: faceDetected ?? false,
        usedOriginalImage: usedOriginalImage ?? true,
        faceConfidence: faceConfidence ?? 0,
      });
    }

    // 5. 验证季节类型
    if (!isSeasonType(inference.season)) {
      throw new Error("Inference service returned an unsupported season.");
    }

    // 6. 准备基础数据
    const season = SEASONS[inference.season];
    const labFeatures = inference.lab_features ?? { L: 65, a: 8, b: 12 };
    
    // 7. 获取用户画像
    const userProfile = await getUserProfile(user.uid);
    const userProfileContext = userProfile ? buildUserProfilePromptContext(userProfile) : undefined;

    // 8. 【关键】先生成 AI 建议（使用季节的基础数据，而不是 diagnosis）
    console.info("[diagnose-debug] 开始生成豆包风格建议...");
    const doubaoAdvice = await generateDoubaoStyleAdvice({
      season: inference.season,
      confidence: inference.confidence,
      lab_features: labFeatures,
      userProfile: userProfileContext,
      recommended_colors: season.palette.slice(0, 3),  // 使用季节色板
      avoid_colors: season.avoid.slice(0, 2),          // 使用避免颜色
      keywords: season.keywords,                       // 使用季节关键词
    }).catch((error) => {
      console.error("[diagnose-debug] 生成豆包建议失败:", error);
      return null;
    });

    // 9. 【然后】创建诊断对象（此时 doubaoAdvice 已经存在）
    const diagnosis = {
      seasonType: inference.season,
      confidence: inference.confidence,
      colorPalette: doubaoAdvice?.personalized_color_palette || season.palette, // 优先使用个性化色板
      styleKeywords: season.keywords,
      avoidColors: season.avoid,
      aiDescription: season.styleDesc,
      labFeatures: labFeatures,
      source: inference.source,
      scores: inference.scores,
      faceDetected,
      usedOriginalImage,
      faceConfidence,
    };
    
    const { scores, ...requiredDiagnosisFields } = diagnosis;

    // 10. 保存到数据库
    let diagnosisId: string;
    try {
      const docRef = await getAdminDb().collection("diagnoses").add({
        ...requiredDiagnosisFields,
        ...(scores === undefined ? {} : { scores }),
        doubaoAdvice,
        userId: user.uid,
        createdAt: new Date(),
      });
      diagnosisId = docRef.id;
      console.info("[diagnose-debug] 保存成功", { diagnosisId });
    } catch (error) {
      console.error("[diagnose-debug] 保存失败:", error);
      return NextResponse.json({ success: false, error: "诊断完成，但保存结果失败，请稍后重试。" }, { status: 500 });
    }

    // 11. 返回结果
    return NextResponse.json({
      success: true,
      diagnosisId,
      data: {
        ...diagnosis,
        doubaoAdvice,
      },
    });
    
  } catch (error) {
    // 错误处理
    if (error instanceof NoClearFaceError) {
      return NextResponse.json(
        { success: false, error: "NO_CLEAR_FACE", message: error.message, quality: error.quality },
        { status: 422 }
      );
    }
    if (error instanceof ModelUnavailableError) {
      return NextResponse.json(
        { success: false, error: "MODEL_UNAVAILABLE", message: error.message },
        { status: 503 }
      );
    }
    if (error instanceof InferenceTimeoutError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 504 });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "诊断失败，请稍后重试。" },
      { status: 422 }
    );
  }
}