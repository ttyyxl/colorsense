import type { SeasonType } from "./seasons";

export interface LabFeatures {
  L: number;
  a: number;
  b: number;
}

export interface Diagnosis {
  id: string;
  user_id?: string;
  created_at: string;
  image_url?: string;
  image_name?: string;
  season_type: SeasonType;
  confidence: number;
  color_palette: string[];
  style_keywords: string[];
  ai_description: string;
  lab_features: LabFeatures;
  scores?: Partial<Record<SeasonType, number>>;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
