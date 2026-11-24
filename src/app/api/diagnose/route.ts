import { NextResponse } from "next/server";
import { SEASONS } from "@/lib/seasons";
import type { SeasonType } from "@/lib/seasons";
import { verifyAuth } from "@/lib/auth-server";
import { generateDoubaoStyleAdvice } from "@/lib/ai";
import type { DiagnosisQuality, NewDiagnosis } from "@/lib/types";
import { createDiagnosis } from "@/lib/server/diagnoses";
import { getUserProfile } from "@/lib/server/user-profiles";
import { buildUserProfilePromptContext } from "@/lib/user-profile-summary";
import { analyzeSeasonWithDoubao, readVisionConfigFromEnv } from "@/lib/doubao-vision";
import type { VisionAnalysisResult } from "@/lib/doubao-vision";
import {
  classifyVisionFailure,
  FusionConfigError,
  FusionUnavailableError,
  readFusionConfig,
  type DoubaoFusionInput,
  type FusionUnavailableCode,
} from "@/lib/fusion";
import { assembleDiagnosisFields, assembleAdvancedDiagnosisFields } from "@/lib/fusion-api";
import { assessImageQuality, mergeFaceSignalIntoQuality } from "@/lib/image-quality";
import { isExecutableDiagnosisStatus } from "@/lib/diagnosis-status";
import type { DiagnosisRiskEntry, DiagnosisStatus, InferenceMode } from "@/lib/diagnosis-types";

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
        payload.quality ?? { faceDetected: false, usedOriginalImage: true, faceConfidence: 0 },
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

  const canUseDiagnosisFeatures = user.email_verified === true;
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
    // 3. 读取融合配置。FUSION_ENABLED=false 时保持第一阶段完整行为。
    const fusionConfig = readFusionConfig(process.env);
    const imageBytes = new Uint8Array(await image.arrayBuffer());

    // 4. 本地图像质量预检：在付费视觉 API 与 CNN 推理之前执行，严重异常直接拦截，
    //    避免为无法可靠诊断的照片产生不必要的 API 费用。仅在融合开启时启用。
    let precheckQuality = null;
    if (fusionConfig.enabled) {
      precheckQuality = await assessImageQuality(imageBytes);
      if (precheckQuality.qualityLevel === "REJECT") {
        return NextResponse.json({
          success: true,
          blocked: true,
          diagnosisStatus: "RETAKE_REQUIRED",
          imageQuality: precheckQuality,
          recommendations: precheckQuality.recommendation,
        });
      }
    }

    // Doubao 视觉模块有独立总开关；两个开关必须同时打开才会发起付费调用。
    let doubaoUnavailableCode: FusionUnavailableCode | undefined;
    if (fusionConfig.enabled) {
      const visionMasterEnabled =
        (process.env.VISION_DIAGNOSIS_ENABLED ?? "false").trim().toLowerCase() === "true";
      if (!visionMasterEnabled) {
        doubaoUnavailableCode = "DOUBAO_MASTER_DISABLED";
      } else {
        try {
          readVisionConfigFromEnv();
        } catch (error) {
          doubaoUnavailableCode = classifyVisionFailure(error);
        }
      }
    }
    const shouldCallDoubao = fusionConfig.enabled && doubaoUnavailableCode === undefined;

    // 5. 并行执行 CNN 推理与 Doubao 视觉诊断：一个模型失败不会丢弃另一个的有效结果。
    const cnnTask = runInference(image);
    const doubaoTask: Promise<VisionAnalysisResult | null> = shouldCallDoubao
      ? (async () => analyzeSeasonWithDoubao(imageBytes, image.type))()
      : Promise.resolve(null);
    const [cnnSettled, doubaoSettled] = await Promise.allSettled([cnnTask, doubaoTask]);

    // 6. CNN 结果：保留原有错误分类、人脸质量门控与季型校验。
    if (cnnSettled.status === "rejected") {
      throw cnnSettled.reason;
    }
    const inference = cnnSettled.value;

    if (inference.source !== "model") {
      throw new ModelUnavailableError();
    }

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

    if (!isSeasonType(inference.season)) {
      throw new Error("Inference service returned an unsupported season.");
    }

    // 7. 合并人脸信号到质量评估。FaceAreaRatio 由服务端人脸门控校验，这里标记 unknown，
    //    不伪造具体数值。faceCount=1（多人脸在服务端已拦截）。
    const finalQuality = precheckQuality
      ? mergeFaceSignalIntoQuality(precheckQuality, {
          detected: faceDetected,
          confidence: faceConfidence,
          count: 1,
          note: "人脸框占比已由推理服务的人脸门控校验（单人、框尺寸、关键点几何）；此字段不提供具体比例。",
        })
      : null;

    // 8. Doubao 结果：失败/拒判由融合层统一降级，只记录机器可读代码与安全元信息。
    let doubao: DoubaoFusionInput | null = null;
    let doubaoCode: FusionUnavailableCode = doubaoUnavailableCode ??
      (fusionConfig.enabled ? "DOUBAO_MISSING" : "FUSION_DISABLED");
    if (doubaoSettled.status === "rejected") {
      // 网络异常/超时/鉴权失败等：属于服务不可用，继续沿用 DEGRADED 机制。
      doubaoCode = classifyVisionFailure(doubaoSettled.reason);
    } else if (doubaoSettled.value) {
      // API 调用成功。模型主动拒判（can_judge_reliably=false）不是服务故障，
      // 由融合层按「诊断可靠性问题」处理，不重试、不记为降级。
      doubao = doubaoSettled.value;
      doubaoCode = doubao.result.can_judge_reliably === true ? "OK" : "DOUBAO_UNRELIABLE";
    }

    // 9. v2 状态化组装：RETAKE_REQUIRED / FAILED 不产生任何正式季型字段。
      let fields: Record<string, unknown>;
      let diagnosisStatus: DiagnosisStatus = "CONFIDENT";
      let inferenceMode: InferenceMode = "dual";
      let uncertaintyReasons: string[] = [];
      let risks: DiagnosisRiskEntry[] = [];
      let decisiveReasons: string[] = [];
      let softWarnings: string[] = [];
      let recommendations: string[] = [];
    if (fusionConfig.enabled && finalQuality) {
      const advanced = assembleAdvancedDiagnosisFields({
        fusionEnabled: true,
        cnnWeight: fusionConfig.cnnWeight,
        cnn: { season: inference.season, scores: inference.scores },
        cnnCode: "OK",
        doubao,
        doubaoCode,
        imageQuality: finalQuality,
        legacy: {
          seasonType: inference.season,
          confidence: inference.confidence,
          scores: inference.scores,
        },
      });
      diagnosisStatus = advanced.diagnosisStatus;
      inferenceMode = advanced.inferenceMode;
      uncertaintyReasons = advanced.uncertaintyReasons;
      risks = advanced.risks;
      decisiveReasons = advanced.decisiveReasons;
      softWarnings = advanced.softWarnings;
      recommendations = advanced.recommendations;

      if (advanced.blocked) {
        // 不保存诊断记录，不生成季型，不进入画像/穿搭链路。
        return NextResponse.json({
          success: true,
          blocked: true,
          diagnosisStatus: advanced.diagnosisStatus,
          inferenceMode: advanced.inferenceMode,
          uncertaintyReasons: advanced.uncertaintyReasons,
          risks: advanced.risks,
          decisiveReasons: advanced.decisiveReasons,
          softWarnings: advanced.softWarnings,
          recommendations: advanced.recommendations,
          imageQuality: finalQuality,
        });
      }
      fields = {
        seasonType: advanced.seasonType,
        confidence: advanced.confidence,
        scores: advanced.scores,
        fusionDiagnosis: advanced.fusionDiagnosis,
        diagnosisStatus: advanced.diagnosisStatus,
        inferenceMode: advanced.inferenceMode,
        uncertaintyReasons: advanced.uncertaintyReasons,
        risks: advanced.risks,
        decisiveReasons: advanced.decisiveReasons,
        softWarnings: advanced.softWarnings,
        recommendations: advanced.recommendations,
      };
    } else {
      const legacyFields = assembleDiagnosisFields({
        fusionEnabled: false,
        cnnWeight: fusionConfig.cnnWeight,
        cnn: { season: inference.season, scores: inference.scores },
        cnnCode: "OK",
        doubao: null,
        doubaoCode: "FUSION_DISABLED",
        legacy: {
          seasonType: inference.season,
          confidence: inference.confidence,
          scores: inference.scores,
        },
      });
      fields = { ...legacyFields };
    }

    const finalSeason = fields.seasonType as SeasonType;
    const season = SEASONS[finalSeason];
    const labFeatures = inference.lab_features ?? { L: 65, a: 8, b: 12 };
    // Phase 3.3：诊断可信程度与业务可执行性解耦。
    // 只要存在有效季型结果（未处于 RETAKE_REQUIRED / FAILED 硬阻断），就允许生成
    // 个性化建议；UNCERTAIN / DEGRADED 会在结果与建议中明确提示不确定性。
    const hasValidSeasonResult = isExecutableDiagnosisStatus(diagnosisStatus);

    // 10. 获取用户画像
    const userProfile = await getUserProfile(user.uid);
    const userProfileContext = userProfile ? buildUserProfilePromptContext(userProfile) : undefined;

    // 11. 风格建议：只要存在有效季型结果就生成个性化建议。
    //     Phase 3.3 起不再以 diagnosisStatus === "CONFIDENT" 作为前置条件——
    //     低置信度结果同样允许生成后续穿搭建议，只是不确定性提示随结果一并返回。
    const doubaoAdvice = hasValidSeasonResult
      ? await generateDoubaoStyleAdvice({
          season: finalSeason,
          confidence: fields.confidence as number,
          lab_features: labFeatures,
          userProfile: userProfileContext,
          recommended_colors: season.palette.slice(0, 3),
          avoid_colors: season.avoid.slice(0, 2),
          keywords: season.keywords,
        }).catch(() => null)
      : null;

    // 12. 创建诊断对象（CONFIDENT/UNCERTAIN/DEGRADED 均保存以便历史追溯）。
    const diagnosis: NewDiagnosis = {
      seasonType: finalSeason,
      confidence: fields.confidence as number,
      ...(fields.scores === undefined ? {} : { scores: fields.scores as NewDiagnosis["scores"] }),
      ...(fields.fusionDiagnosis === undefined
        ? {}
        : { fusionDiagnosis: fields.fusionDiagnosis as NewDiagnosis["fusionDiagnosis"] }),
      colorPalette: doubaoAdvice?.personalized_color_palette || season.palette,
      styleKeywords: season.keywords,
      avoidColors: season.avoid,
      aiDescription: season.styleDesc,
      labFeatures,
      source: inference.source,
      faceDetected,
      usedOriginalImage,
      faceConfidence,
      diagnosisStatus,
      inferenceMode,
      uncertaintyReasons,
      risks,
      decisiveReasons,
      softWarnings,
      recommendations,
      hasValidSeasonResult,
      ...(doubaoAdvice ? { doubaoAdvice } : {}),
    };

    // 13. 保存诊断记录到 CloudBase PostgreSQL。
    let diagnosisId: string;
    try {
      diagnosisId = await createDiagnosis(user.uid, diagnosis);
      console.info("[diagnose-debug] 保存成功", { diagnosisId });
    } catch (error) {
      console.error("[diagnose-debug] 保存失败:", error);
      return NextResponse.json({ success: false, error: "诊断完成，但保存结果失败，请稍后重试。" }, { status: 500 });
    }

    // 14. 返回与数据库写入相同的结果对象。
    return NextResponse.json({
      success: true,
      diagnosisId,
      data: diagnosis,
    });

  } catch (error) {
    if (error instanceof FusionConfigError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: 500 }
      );
    }
    if (error instanceof FusionUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: "DIAGNOSIS_FAILED",
          code: error.code,
          diagnosisStatus: "FAILED",
          message: "两个模型均无法给出有效的四季评分，请上传光线更合适的正面照片后重试。",
          fallbackDetails: error.details,
        },
        { status: 422 }
      );
    }
    if (error instanceof NoClearFaceError) {
      // 融合模式下把无人脸/低置信度归类为 RETAKE_REQUIRED，并给出具体重新上传建议。
      const fusionEnabled = (process.env.FUSION_ENABLED ?? "false").trim().toLowerCase() === "true";
      if (fusionEnabled) {
        return NextResponse.json({
          success: true,
          blocked: true,
          diagnosisStatus: "RETAKE_REQUIRED",
          uncertaintyReasons: ["NO_CLEAR_FACE"],
          recommendations: [
            "未检测到清晰人脸，请上传清晰、正对镜头的真人正脸照片。",
            "避免遮挡、墨镜、口罩，并保证面部光线均匀。",
            "请勿上传动物、卡通、风景、物体或多人合照。",
          ],
          imageQuality: error.quality,
        });
      }
      return NextResponse.json(
        { success: false, error: "NO_CLEAR_FACE", message: error.message, quality: error.quality },
        { status: 422 }
      );
    }
    if (error instanceof ModelUnavailableError) {
      return NextResponse.json({ success: false, error: "MODEL_UNAVAILABLE", message: error.message }, { status: 503 });
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
