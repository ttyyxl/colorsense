"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";
import { EmailLoginForm } from "@/components/EmailLoginForm";
import { EmailRegisterForm } from "@/components/EmailRegisterForm";
import { resolveNextPath, Notice } from "@/components/auth-utils";
import { useAuth } from "@/lib/useAuth";

interface LoginPageProps {
  searchParams?: { next?: string };
}

type AuthMode = "login" | "register";

export default function LoginPage({ searchParams }: LoginPageProps) {
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const requestedNext = searchParams?.next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/upload";
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const isVerificationReturn = new URLSearchParams(window.location.search).get("verified") === "1";
    if (isVerificationReturn) {
      setNotice({ type: "success", text: "邮箱验证成功，请使用邮箱和密码登录。" });
    }
  }, []);

  useEffect(() => {
    if (loading || !currentUser || !currentUser.emailVerified) {
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

          <div className="mt-6">{authMode === "login" ? <EmailLoginForm nextPath={nextPath} /> : <EmailRegisterForm nextPath={nextPath} />}</div>
        </div>
      </section>
      <FooterGradient />
    </main>
  );
}
