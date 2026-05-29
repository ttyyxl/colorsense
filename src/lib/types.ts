import type { SeasonType } from "./seasons";
import type { DoubaoStyleAdvice } from "./ai";

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
