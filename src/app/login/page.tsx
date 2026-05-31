'use client';
import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";
import { EmailLoginForm } from "@/components/EmailLoginForm";
import { EmailRegisterForm } from "@/components/EmailRegisterForm";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { resolveNextPath, Notice } from "@/components/auth-utils";
import { useRouter } from "next/navigation";

interface LoginPageProps {
  searchParams?: { next?: string };
}

type AuthMode = "login" | "register";

export default function LoginPage({ searchParams }: LoginPageProps) {
  const router = useRouter();
  const requestedNext = searchParams?.next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/upload";
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState<Notice>(null);

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto flex max-w-xl flex-col px-6 py-12 sm:py-16">
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-100 sm:p-8">
          <h1 className="text-3xl font-bold text-slate-950">欢迎来到 ColorSense</h1>
          <p className="mt-3 leading-7 text-slate-600">
            请选择登录或注册。
          </p>

          <div className="mt-6 flex space-x-4">
            <button
              className={`px-4 py-2 rounded-xl font-semibold ${
                authMode === "login"
                  ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 border border-indigo-200"
              }`}
              onClick={() => setAuthMode("login")}
            >
              登录
            </button>
            <button
              className={`px-4 py-2 rounded-xl font-semibold ${
                authMode === "register"
                  ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 border border-indigo-200"
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

          <div className="mt-6">
            {authMode === "login" ? (
              <EmailLoginForm nextPath={nextPath} />
            ) : (
              <EmailRegisterForm nextPath={nextPath} />
            )}
          </div>

          <GoogleAuthSection nextPath={nextPath} />
        </div>
      </section>
      <FooterGradient />
    </main>
  );
}
