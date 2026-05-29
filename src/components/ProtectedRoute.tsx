"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

function canUseProtectedPages(providerIds: string[], emailVerified: boolean) {
  return emailVerified || providerIds.includes("google.com");
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, loading } = useAuth();
  const authorized =
    Boolean(currentUser) &&
    canUseProtectedPages(currentUser?.providerData.map((provider) => provider.providerId) ?? [], currentUser?.emailVerified ?? false);

  useEffect(() => {
    if (!loading && !authorized) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authorized, loading, pathname, router]);

  if (loading || !authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-indigo-50 px-6">
        <p className="rounded-xl bg-white px-5 py-4 text-slate-600 shadow-sm">
          {loading ? "正在确认登录状态..." : "请先登录并完成邮箱验证。"}
        </p>
      </main>
    );
  }

  return children;
}
