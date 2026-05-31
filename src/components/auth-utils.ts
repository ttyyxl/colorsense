import { auth, isFirebaseConfigured } from "@/lib/firebase";

export type Notice = { type: "success" | "error"; text: string } | null;

export function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export function getVerificationReturnUrl() {
  return `${getAppUrl()}/login?verified=1`;
}

export async function resolveNextPath(defaultPath: string) {
  if (!auth?.currentUser) {
    return defaultPath;
  }

  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch("/api/user-profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json()) as { success?: boolean; onboardingCompleted?: boolean };
    if (payload.success && !payload.onboardingCompleted) {
      return "/onboarding/style-profile";
    }
  } catch {
    return defaultPath;
  }

  return defaultPath;
}

export function canSubmit(email: string, password: string, setNotice: (notice: Notice) => void) {
  if (!isFirebaseConfigured() || !auth) {
    setNotice({ type: "error", text: "尚未配置 Firebase 环境变量，请先完成本地配置。" });
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    setNotice({ type: "error", text: "请输入有效邮箱地址。" });
    return false;
  }
  if (password.length < 6) {
    setNotice({ type: "error", text: "密码至少需要 6 位字符。" });
    return false;
  }
  return true;
}
