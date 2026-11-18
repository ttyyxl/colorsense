"use client";

import { getCloudBaseAuth } from "@/lib/cloudbase";

/** 获取当前登录态 access token（未登录时为 null）。 */
export async function getAuthToken(): Promise<string | null> {
  const auth = getCloudBaseAuth();
  if (!auth) {
    return null;
  }

  try {
    const result = await auth.getAccessToken();
    return result?.accessToken ?? null;
  } catch {
    return null;
  }
}

/** 携带 CloudBase access token 调用站内 API。 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function apiJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init);
  const payload = (await response.json().catch(() => null)) as T;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return payload;
}

export async function postJson<T>(input: string, body: unknown): Promise<T> {
  return apiJson<T>(input, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function putJson<T>(input: string, body: unknown): Promise<T> {
  return apiJson<T>(input, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
