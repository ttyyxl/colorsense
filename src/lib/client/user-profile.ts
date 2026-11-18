"use client";

import { apiJson, putJson } from "./api";
import type { Diagnosis } from "@/lib/types";
import type { ProfileOutput } from "@/lib/ai";
import type { UserStyleProfile } from "@/lib/user-profile-types";

export interface UserProfileResponse {
  success?: boolean;
  user?: { uid: string; email: string | null };
  onboardingCompleted?: boolean;
  profile?: UserStyleProfile | null;
}

export async function getUserProfile(): Promise<UserProfileResponse | null> {
  try {
    return await apiJson<UserProfileResponse>("/api/user-profile");
  } catch {
    return null;
  }
}

export async function saveUserProfile(profile: unknown): Promise<void> {
  await putJson("/api/user-profile", profile);
}

export async function getLatestDiagnosis(): Promise<Diagnosis | null> {
  const payload = await apiJson<{ success?: boolean; diagnosis?: Diagnosis | null }>(
    "/api/user-profile/latest-diagnosis",
  );
  return payload.diagnosis ?? null;
}

export async function generateProfileAdvice(): Promise<ProfileOutput | null> {
  const payload = await apiJson<{ success?: boolean; data?: ProfileOutput | null }>(
    "/api/generate-profile-advice",
    { method: "POST" },
  );
  return payload.data ?? null;
}
