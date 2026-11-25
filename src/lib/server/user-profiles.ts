import type { ProfileOutput } from "@/lib/ai";
import type { UserStyleProfile } from "@/lib/user-profile-types";
import type { ColorCardTestResult } from "@/lib/color-card";
import { byUser, pgSelectOne, pgUpsert } from "./pg";

const TABLE = "cs_users";

interface UserRow {
  user_id: string;
  email: string;
  nickname: string;
  onboarding_completed: boolean;
  profile_version: number;
  profile: UserStyleProfile | null;
  generated_profile_advice: ProfileOutput | null;
  created_at: string;
  updated_at: string;
}

export interface AccountProfile {
  nickname: string;
  email: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function getUserRow(userId: string): Promise<UserRow | null> {
  return pgSelectOne<UserRow>(TABLE, { filters: [["user_id", "eq", userId]] });
}

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  const row = await getUserRow(userId);
  if (!row) {
    return null;
  }
  return {
    nickname: typeof row.nickname === "string" ? row.nickname : "",
    email: typeof row.email === "string" ? row.email : "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveAccountProfile(userId: string, email: string, nickname: string): Promise<void> {
  const trimmedNickname = nickname.trim();
  if (!trimmedNickname) {
    throw new Error("NICKNAME_REQUIRED");
  }

  await pgUpsert(
    TABLE,
    {
      user_id: userId,
      email,
      nickname: trimmedNickname,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function getUserProfile(userId: string): Promise<UserStyleProfile | null> {
  const row = await getUserRow(userId);
  if (!row || !row.profile) {
    return null;
  }

  return {
    ...(row.profile as UserStyleProfile),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveUserProfile(
  userId: string,
  email: string | null,
  profileInput: Omit<UserStyleProfile, "aiPromptReady" | "promptContext" | "generatedProfileAdvice" | "createdAt" | "updatedAt">,
  promptContext: UserStyleProfile["promptContext"],
): Promise<void> {
  const now = new Date().toISOString();
  await pgUpsert(
    TABLE,
    {
      user_id: userId,
      ...(email ? { email } : {}),
      onboarding_completed: true,
      profile_version: 2,
      profile: {
        ...profileInput,
        aiPromptReady: true,
        promptContext,
      },
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
}

export async function saveColorCardTest(userId: string, result: ColorCardTestResult): Promise<void> {
  const row = await getUserRow(userId);
  if (!row || !row.profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  await pgUpsert(
    TABLE,
    {
      user_id: userId,
      profile: {
        ...(row.profile as UserStyleProfile),
        colorCardTest: result,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function saveGeneratedProfileAdvice(userId: string, advice: ProfileOutput): Promise<void> {
  await pgUpsert(
    TABLE,
    {
      user_id: userId,
      generated_profile_advice: advice,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function getUserGeneratedAdvice(userId: string): Promise<ProfileOutput | null> {
  const row = await getUserRow(userId);
  return row?.generated_profile_advice ?? null;
}

export { byUser };
