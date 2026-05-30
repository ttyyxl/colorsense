import { ProfileOutput } from "@/lib/ai";

export interface UserQuestionnaireRequiredInfo {
  gender?: string;
  genderOther?: string;
  ageRange?: string;
  dailyScene?: string;
  dailySceneOther?: string;
}

export interface UserQuestionnaireOptionalInfo {
  skinTone?: string;
  eyeColor?: string;
  hairColor?: string;
  stylePreferences: string[];
  stylePreferenceOther?: string;
  makeupPreferences: string[];
  makeupPreferenceOther?: string;
  favoriteColors?: string[];
}

export interface UserQuestionnaireExternalFeatures {
  faceContour: string[];
  facialDetails: string[];
  skinHairContrast: string[];
}

export interface UserQuestionnaireStyleTendency {
  values: string[];
  other?: string;
}

export interface UserStyleProfilePromptFields {
  gender: string;
  ageRange: string;
  dailyScene: string;
  skinTone: string;
  eyeColor: string;
  hairColor: string;
  faceContour: string[];
  facialDetails: string[];
  skinHairContrast: string[];
  styleTendency: string[];
  stylePreferences: string[];
  makeupPreferences: string[];
  favoriteColors: string[];
}

export interface UserStyleProfilePromptContext {
  summaryText: string;
  tags: string[];
  promptFields: UserStyleProfilePromptFields;
}

export interface UserStyleProfile {
  requiredInfo: UserQuestionnaireRequiredInfo;
  optionalInfo: UserQuestionnaireOptionalInfo;
  externalFeatures: UserQuestionnaireExternalFeatures;
  styleTendency: UserQuestionnaireStyleTendency;
  aiPromptReady: boolean;
  promptContext: UserStyleProfilePromptContext;
  generatedProfileAdvice?: ProfileOutput; // Add this line
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type UserStyleProfileInput = Pick<UserStyleProfile, "requiredInfo" | "optionalInfo" | "externalFeatures" | "styleTendency">;
