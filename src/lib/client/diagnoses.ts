"use client";

import { apiJson, apiFetch } from "./api";
import type { Diagnosis } from "@/lib/types";

export async function listUserDiagnoses(): Promise<Diagnosis[]> {
  const payload = await apiJson<{ success?: boolean; diagnoses?: Diagnosis[] }>("/api/diagnoses");
  return payload.diagnoses ?? [];
}

export async function getUserDiagnosis(id: string): Promise<Diagnosis | null> {
  const response = await apiFetch(`/api/diagnoses/${encodeURIComponent(id)}`);
  if (response.status === 404) {
    return null;
  }
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; diagnosis?: Diagnosis | null }
    | null;
  if (!response.ok) {
    throw new Error(payload && "error" in payload ? String(payload.error) : "读取诊断记录失败。");
  }
  return payload?.diagnosis ?? null;
}

export async function deleteUserDiagnosis(id: string): Promise<void> {
  const payload = await apiJson<{ success?: boolean }>(`/api/diagnoses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!payload.success) {
    throw new Error("删除诊断记录失败。");
  }
}
