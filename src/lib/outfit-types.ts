import type { UserStyleProfile } from "./user-profile-types";

export type OutfitScene = "daily" | "travel";

export interface WeatherInfo {
  city: string;
  temperature: string;
  condition: string;
  source?: "weatherapi" | "mock";
}

export interface OutfitProfileInput {
  favoriteColors: string[];
  stylePreferences: string[];
  makeupPreference: string;
  rawProfile?: UserStyleProfile | null;
}

export interface OutfitInspirationRequest {
  season: string;
  profile: OutfitProfileInput;
  scene: OutfitScene;
  occasion: string;
  mood: string;
  weather?: WeatherInfo | null;
}

export interface OutfitInspirationResult {
  theme: string;
  mainColor: string;
  secondaryColor: string;
  accentColor: string;
  top: string;
  bottom: string;
  outerwear: string;
  shoes: string;
  bag: string;
  accessories: string;
  makeup: string;
  reason: string;
}

export interface OutfitInspirationResponse {
  success: true;
  data: OutfitInspirationResult;
  source: "mock" | "ai";
}

export interface OutfitInspirationError {
  success: false;
  error: string;
  message?: string;
}

export type OutfitInspirationApiResponse = OutfitInspirationResponse | OutfitInspirationError;
