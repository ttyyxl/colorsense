"use client";

import { apiJson, putJson } from "./api";

export interface AccountProfile {
  nickname: string;
  email: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function getAccountProfile(): Promise<AccountProfile | null> {
  try {
    const payload = await apiJson<{ success?: boolean; profile?: AccountProfile | null }>("/api/account-profile");
    return payload.profile ?? null;
  } catch {
    return null;
  }
}

export async function saveAccountProfile(email: string, nickname: string) {
  const trimmedNickname = nickname.trim();
  if (!trimmedNickname) {
    throw new Error("NICKNAME_REQUIRED");
  }

  await putJson("/api/account-profile", { email, nickname: trimmedNickname });
}
