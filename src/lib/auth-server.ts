import { headers } from "next/headers";

/**
 * 服务端鉴权：校验前端携带的 CloudBase 登录态 access_token。
 *
 * 流程：
 * 1. 读取 Authorization: Bearer <access_token>
 * 2. 调用 CloudBase 网关 GET /auth/v1/user/me 获取用户信息
 * 3. 必要时调用 GET /auth/v1/token/introspect 兜底获取 uid（sub）
 */

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  email_verified: boolean;
}

const ENV_ID = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;

function gatewayBase() {
  if (!ENV_ID) {
    throw new Error("尚未配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID，无法校验登录态。");
  }
  return `https://${ENV_ID}.api.tcloudbasegateway.com`;
}

function getBearerToken() {
  const authHeader = headers().get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.slice("Bearer ".length).trim();
}

async function callGateway(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${gatewayBase()}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return null;
}

function unwrap(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...payload, ...(nested as Record<string, unknown>) };
  }
  return payload;
}

export async function verifyAuth(): Promise<AuthenticatedUser | null> {
  const token = getBearerToken();

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-debug]", {
      authorizationHeaderPresent: Boolean(token),
      tokenLength: token.length,
      cloudbaseEnvPresent: Boolean(ENV_ID),
    });
  }

  if (!token) {
    return null;
  }

  const me = await callGateway("/auth/v1/user/me", token);
  let uid = me ? pickString(unwrap(me), ["sub", "uid", "id", "user_id", "userId"]) : null;
  let email = me ? pickString(unwrap(me), ["email"]) : null;

  if (!uid) {
    const introspect = await callGateway("/auth/v1/token/introspect", token);
    if (introspect) {
      const flat = unwrap(introspect);
      uid = pickString(flat, ["sub", "uid", "user_id", "userId"]);
      email = email ?? pickString(flat, ["email"]);
    }
  }

  if (!uid) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth-debug] 无法从 CloudBase 网关解析用户标识", { me });
    }
    return null;
  }

  // 能拿到有效会话即视为已通过云端校验（开启邮箱验证时，未验证的账号无法获得会话）。
  const verifiedFlag = me ? unwrap(me).email_verified : undefined;
  const email_verified = typeof verifiedFlag === "boolean" ? verifiedFlag : true;

  return { uid, email, email_verified };
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await verifyAuth();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
