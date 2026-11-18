"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getAuthToken } from "@/lib/client/api";

function requiresCompletedQuestionnaire(pathname: string) {
  return ["/upload", "/history", "/processing", "/result", "/outfit"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, loading } = useAuth();
  const [checkingQuestionnaire, setCheckingQuestionnaire] = useState(false);
  const authorized = Boolean(currentUser) && currentUser?.emailVerified === true;

  useEffect(() => {
    if (!loading && !authorized) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authorized, loading, pathname, router]);

  useEffect(() => {
    let active = true;

    async function checkQuestionnaire() {
      if (!authorized || !currentUser || !requiresCompletedQuestionnaire(pathname)) {
        setCheckingQuestionnaire(false);
        return;
      }

      setCheckingQuestionnaire(true);
      try {
        const token = await getAuthToken();
        const response = await fetch("/api/user-profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = (await response.json()) as { success?: boolean; onboardingCompleted?: boolean; profile?: unknown };
        if (!active) {
          return;
        }
        if (!payload.success || !payload.onboardingCompleted || !payload.profile) {
          router.replace("/onboarding/style-profile");
          return;
        }
      } catch {
        if (active) {
          router.replace("/onboarding/style-profile");
        }
      } finally {
        if (active) {
          setCheckingQuestionnaire(false);
        }
      }
    }

    void checkQuestionnaire();

    return () => {
      active = false;
    };
  }, [authorized, currentUser, pathname, router]);

  if (loading || !authorized || checkingQuestionnaire) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-indigo-50 px-6">
        <p className="rounded-xl bg-white px-5 py-4 text-slate-600 shadow-sm">
          {loading || checkingQuestionnaire ? "正在确认登录状态..." : "请先登录并完成邮箱验证。"}
        </p>
      </main>
    );
  }

  return children;
}
