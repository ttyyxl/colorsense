"use client";

import { getCloudBaseAuth } from "@/lib/cloudbase";

/**
 * 应用内统一的登录用户结构，字段与原 Firebase User 保持兼容，
 * 以减少页面层改动（uid / email / emailVerified / displayName / photoURL）。
 */
export interface AppUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  providerData: { providerId: string }[];
}

interface RawUser {
  id?: unknown;
  email?: unknown;
  email_confirmed_at?: unknown;
  confirmed_at?: unknown;
  user_metadata?: Record<string, unknown> | null;
}

interface RawSession {
  user?: RawUser | null;
  access_token?: string | null;
}

function pickText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function toAppUser(user: RawUser | null | undefined, hasSession: boolean): AppUser | null {
  if (!user || typeof user !== "object") {
    return null;
  }

  const uid = user.id === undefined || user.id === null ? "" : String(user.id);
  if (!uid) {
    return null;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  return {
    uid,
    email: pickText(user.email),
    // 能拿到有效会话即代表已通过云端校验（开启邮箱验证时未验证账号无法获得会话）。
    emailVerified: Boolean(user.email_confirmed_at ?? user.confirmed_at) || hasSession,
    displayName: pickText(meta.nickName) ?? pickText(meta.name) ?? pickText(meta.username),
    photoURL: pickText(meta.avatarUrl) ?? pickText(meta.picture),
    providerData: [],
  };
}

export function toAppUserFromSession(session: RawSession | null | undefined): AppUser | null {
  return toAppUser(session?.user, Boolean(session?.access_token));
}

function describeError(error: unknown, fallback: string): string {
  const record = (error ?? {}) as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  if (code === "invalid_username_or_password" || code === "invalid_password" || code === "user_not_found") {
    return "邮箱或密码不正确。";
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return "该邮箱已注册，请直接登录。";
  }
  if (code === "email_not_confirmed" || code === "unverified_email") {
    return "邮箱尚未验证，请先完成邮箱验证。";
  }
  if (code === "invalid_otp" || code === "otp_expired") {
    return "验证码不正确或已过期，请重新获取。";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "操作过于频繁，请稍后再试。";
  }
  if (code === "login_type_disabled") {
    return "该登录方式尚未在 CloudBase 控制台开启。";
  }
  return message || fallback;
}

export interface AuthOutcome {
  user: AppUser | null;
  /** 需要邮箱验证时返回校验回调，用户输入验证码后调用。 */
  verify: ((token: string) => Promise<AppUser>) | null;
}

export async function signInWithPassword(email: string, password: string): Promise<AppUser> {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("尚未配置 CloudBase 环境变量，无法登录。");
  }

  const result = await auth.signInWithPassword({ email: email.trim(), password });
  if (result.error) {
    throw new Error(describeError(result.error, "登录失败，请检查邮箱和密码。"));
  }

  const user = toAppUserFromSession(result.data?.session as RawSession | null);
  if (!user) {
    throw new Error("登录失败，未能获取登录会话。");
  }

  return user;
}

export async function signUpWithPassword(email: string, password: string): Promise<AuthOutcome> {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("尚未配置 CloudBase 环境变量，无法注册。");
  }

  const result = await auth.signUp({ email: email.trim(), password });
  if (result.error) {
    throw new Error(describeError(result.error, "注册失败，请稍后重试。"));
  }

  const data = result.data as {
    user?: RawUser;
    session?: RawSession;
    verifyOtp?: (params: { token: string | number; messageId?: string }) => Promise<{
      data?: { session?: RawSession };
      error?: unknown;
    }>;
  };

  const sessionUser = toAppUserFromSession(data.session);
  if (sessionUser) {
    return { user: sessionUser, verify: null };
  }

  const verifyOtp = data.verifyOtp;
  if (!verifyOtp) {
    throw new Error("注册未完成：服务端未返回验证信息，请检查 CloudBase 邮件服务配置。");
  }

  return {
    user: toAppUser(data.user, false),
    verify: async (token: string) => {
      const verified = await verifyOtp({ token });
      if (verified.error) {
        throw new Error(describeError(verified.error, "验证码校验失败，请重新输入。"));
      }
      const verifiedUser = toAppUserFromSession(verified.data?.session ?? null);
      if (!verifiedUser) {
        throw new Error("验证成功，但未能获取登录会话，请直接使用邮箱密码登录。");
      }
      return verifiedUser;
    },
  };
}

export async function signOutUser(): Promise<void> {
  const auth = getCloudBaseAuth();
  if (!auth) {
    return;
  }
  await auth.signOut();
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("尚未配置 CloudBase 环境变量。");
  }

  const result = await auth.resetPasswordForOld({ old_password: oldPassword, new_password: newPassword });
  if (result.error) {
    throw new Error(describeError(result.error, "修改密码失败，请检查当前密码。"));
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getCloudBaseAuth();
  if (!auth) {
    throw new Error("尚未配置 CloudBase 环境变量。");
  }

  const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}/login`;
  const result = await auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
  if (result.error) {
    throw new Error(describeError(result.error, "发送重置邮件失败，请稍后重试。"));
  }
}
