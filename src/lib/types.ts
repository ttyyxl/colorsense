import type { SeasonType } from "./seasons";
import type { DoubaoStyleAdvice } from "./ai";
import type { FusionDiagnosis } from "./fusion";
import type { AdvancedFusionDiagnosis, DiagnosisStatus } from "./diagnosis-types";

export interface LabFeatures {
  L: number;
  a: number;
  b: number;
}

export interface DiagnosisQuality {
  faceDetected: boolean;
  usedOriginalImage: boolean;
  faceConfidence: number;
}

export interface AiAdvice {
  summary: string;
  clothing: {
    colors: string[];
    advice: string;
  };
  makeup: {
    advice: string;
  };
  avoid: string;
}

export interface GeminiInferenceData {
  season: string;
  confidence: number;
  undertone: string;
  brightness: string;
  contrast: string;
  skin_lab: {
    l: number;
    a: number;
    b: number;
  };
  hair_color: string;
  eye_color: string;
  recommended_colors: string[];
  avoid_colors: string[];
}

export interface GeminiStyleAdvice {
  title: string;
  summary: string;
  style_keywords: string[];
  fashion_recommendations: string[];
  makeup_recommendations: string[];
  hair_recommendations: string[];
  accessory_recommendations: string[];
  avoid_recommendations: string[];
}

export interface Diagnosis {
  id: string;
  userId: string;
  createdAt: string;
  seasonType: SeasonType;
  confidence: number;
  colorPalette: string[];
  styleKeywords: string[];
  avoidColors: string[];
  aiDescription: string;
  labFeatures: LabFeatures;
  source: "model" | "rules" | "mock";
  scores?: Partial<Record<SeasonType, number>>;
  faceDetected?: boolean;
  usedOriginalImage?: boolean;
  faceConfidence?: number;
  aiAdvice?: AiAdvice;
  doubaoAdvice?: DoubaoStyleAdvice;
  /**
   * Phase 3.3：诊断可靠性状态。UNCERTAIN / DEGRADED 同样包含有效季型结果，
   * 不会阻断展示与后续建议；仅 RETAKE_REQUIRED / FAILED 不产出季型。
   */
  diagnosisStatus?: DiagnosisStatus;
  /** Phase 3.3：是否存在合法有效的季型结果（老记录缺失时按存在季型处理）。 */
  hasValidSeasonResult?: boolean;
  /** 可选：CNN + Doubao 综合诊断结果；v1 记录为 1.0，第三阶段记录为 2.0（含诊断状态）。 */
  fusionDiagnosis?: FusionDiagnosis | AdvancedFusionDiagnosis;
}

export type NewDiagnosis = Omit<Diagnosis, "id" | "userId" | "createdAt">;

export interface ApiSuccess<T> {
  success: true;
  diagnosisId: string;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  message?: string;
  quality?: DiagnosisQuality;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
