"use client";

import { apiFetch, postJson, putJson } from "./api";
import type {
  OutfitHistoryRecord,
  OutfitHistorySummary,
  OutfitInspirationRequest,
  OutfitInspirationResult,
} from "@/lib/outfit-types";

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

function errorMessage(payload: Record<string, unknown> | null, fallback: string) {
  const value = payload?.error;
  return typeof value === "string" && value ? value : fallback;
}

export async function listUserOutfitRecords(): Promise<OutfitHistorySummary[]> {
  const response = await apiFetch("/api/outfit-records");
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "加载穿搭记录失败。"));
  }
  return (payload?.records as OutfitHistorySummary[] | undefined) ?? [];
}

export async function getUserOutfitRecord(id: string): Promise<OutfitHistoryRecord | null> {
  const response = await apiFetch(`/api/outfit-records/${encodeURIComponent(id)}`);
  if (response.status === 404) {
    return null;
  }
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "读取穿搭记录失败。"));
  }
  return (payload?.record as OutfitHistoryRecord | undefined) ?? null;
}

export async function createUserOutfitRecord(input: {
  request: OutfitInspirationRequest;
  result: OutfitInspirationResult;
  source: "mock" | "ai";
  imageUrl?: string;
}): Promise<string> {
  const payload = await postJson<{ success?: boolean; id?: string }>("/api/outfit-records", input);
  return payload.id ?? "";
}

export async function updateUserOutfitRecord(
  id: string,
  input: Partial<{
    request: Partial<OutfitInspirationRequest>;
    result: Partial<OutfitInspirationResult>;
    source: "mock" | "ai";
    imageUrl: string;
  }>,
): Promise<string | null> {
  const payload = await putJson<{ success?: boolean; id?: string }>(
    `/api/outfit-records/${encodeURIComponent(id)}`,
    input,
  );
  return payload.id ?? null;
}

export async function deleteUserOutfitRecord(id: string): Promise<boolean> {
  const response = await apiFetch(`/api/outfit-records/${encodeURIComponent(id)}`, { method: "DELETE" });
  return response.ok;
}
