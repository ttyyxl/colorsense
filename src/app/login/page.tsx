"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";
import { EmailLoginForm } from "@/components/EmailLoginForm";
import { EmailRegisterForm } from "@/components/EmailRegisterForm";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { resolveNextPath, Notice } from "@/components/auth-utils";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";

interface LoginPageProps {
  searchParams?: { next?: string };
}

type AuthMode = "login" | "register";

function canUseProtectedPages(providerIds: string[], emailVerified: boolean) {
  return emailVerified || providerIds.includes("google.com");
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const router = useRouter();
  const { currentUser, loading, refreshCurrentUser } = useAuth();
  const requestedNext = searchParams?.next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/upload";
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState<Notice>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);

  useEffect(() => {
    const isVerificationReturn = new URLSearchParams(window.location.search).get("verified") === "1";
    if (!isVerificationReturn || !auth) {
      return;
    }

    let active = true;
    let unsubscribe: () => void = () => undefined;
    setNotice({ type: "success", text: "邮箱验证成功，正在检查登录状态..." });

    unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      unsubscribe();
      if (!active) {
        return;
      }

      if (!currentUser) {
        setNotice({ type: "success", text: "邮箱验证成功，请使用邮箱和密码登录。" });
        setAuthMode("login");
        return;
      }

      try {
        await currentUser.reload();
        if (!active) {
          return;
        }
        if (currentUser.emailVerified) {
          router.replace(await resolveNextPath("/upload"));
          router.refresh();
          return;
        }
        setNotice({ type: "error", text: "邮箱验证状态尚未更新，请刷新页面或重新登录。" });
      } catch {
        if (active) {
          setNotice({ type: "error", text: "邮箱验证状态检查失败，请刷新页面或重新登录。" });
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const checkVerificationStatus = useCallback(
    async (showPendingNotice = true) => {
      if (!currentUser) {
        setNotice({ type: "success", text: "邮箱验证成功后，请使用邮箱和密码登录。" });
        setAuthMode("login");
        return;
      }

      setCheckingVerification(true);
      try {
        const refreshedUser = await refreshCurrentUser();
        const providerIds = refreshedUser?.providerData.map((provider) => provider.providerId) ?? [];
        if (refreshedUser && canUseProtectedPages(providerIds, refreshedUser.emailVerified)) {
          router.replace(await resolveNextPath(nextPath));
          router.refresh();
          return;
        }

        if (showPendingNotice) {
          setNotice({ type: "error", text: "邮箱验证状态尚未更新，请确认已经点击邮件中的验证链接后重试。" });
        }
      } catch {
        if (showPendingNotice) {
          setNotice({ type: "error", text: "邮箱验证状态检查失败，请刷新页面或重新登录。" });
        }
      } finally {
        setCheckingVerification(false);
      }
    },
    [currentUser, nextPath, refreshCurrentUser, router],
  );

  useEffect(() => {
    if (loading || !currentUser) {
      return;
    }

    const providerIds = currentUser.providerData.map((provider) => provider.providerId);
    if (!canUseProtectedPages(providerIds, currentUser.emailVerified)) {
      return;
    }

    let active = true;
    async function redirectVerifiedUser() {
      const destination = await resolveNextPath(nextPath);
      if (!active) {
        return;
      }
      router.replace(destination);
      router.refresh();
    }

    void redirectVerifiedUser();

    return () => {
      active = false;
    };
  }, [currentUser, loading, nextPath, router]);

  useEffect(() => {
    if (!currentUser || currentUser.emailVerified) {
      return;
    }

    function handleFocus() {
      void checkVerificationStatus(false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkVerificationStatus(false);
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkVerificationStatus, currentUser]);

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(129,191,233,0.28),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_45%,#f6f2ff_100%)]">
      <Navbar />
      <section className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-12 sm:py-16">
        <div className="pointer-events-none absolute -right-20 top-8 h-56 w-56 rounded-full bg-[#81bfe9]/20 blur-3xl" aria-hidden="true" />
        <div className="relative rounded-2xl border border-indigo-100 bg-white/76 p-6 shadow-lg shadow-indigo-100/70 backdrop-blur sm:p-8">
          <p className="text-sm font-semibold text-indigo-700">ColorSense 账户</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">欢迎来到 ColorSense</h1>
          <p className="mt-3 leading-7 text-slate-600">请选择登录或注册。完成邮箱验证后，即可保存个人形象信息并开始色彩诊断。</p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 font-semibold transition ${
                authMode === "login" ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-700 hover:bg-white/70"
              }`}
              onClick={() => setAuthMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 font-semibold transition ${
                authMode === "register" ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-700 hover:bg-white/70"
              }`}
              onClick={() => setAuthMode("register")}
            >
              注册
            </button>
          </div>

          {notice && (
            <p
              role="alert"
              className={`mt-4 rounded-xl px-4 py-3 text-sm leading-6 ${
                notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {notice.text}
            </p>
          )}

          {currentUser && !currentUser.emailVerified && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              <p>请在邮箱中点击验证链接，回到本页后系统会自动检查。</p>
              <button
                type="button"
                onClick={() => void checkVerificationStatus(true)}
                disabled={checkingVerification}
                className="mt-3 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {checkingVerification ? "正在检查..." : "我已完成验证"}
              </button>
            </div>
          )}

          <div className="mt-6">{authMode === "login" ? <EmailLoginForm nextPath={nextPath} /> : <EmailRegisterForm nextPath={nextPath} />}</div>

          <GoogleAuthSection nextPath={nextPath} />
        </div>
      </section>
      <FooterGradient />
    </main>
  );
}
