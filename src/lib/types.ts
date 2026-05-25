import type { SeasonType } from "./seasons";

export interface LabFeatures {
  L: number;
  a: number;
  b: number;
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
  source: "fastapi" | "mock";
  scores?: Partial<Record<SeasonType, number>>;
}

export type NewDiagnosis = Omit<Diagnosis, "id" | "userId" | "createdAt">;

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
