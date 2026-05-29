"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

type Notice = { type: "success" | "error"; text: string } | null;

interface AuthFormProps {
  nextPath: string;
}

function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

function getVerificationReturnUrl() {
  return `${getAppUrl()}/login?verified=1`;
}

export function AuthForm({ nextPath }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<"register" | "login" | "google" | null>(null);

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
        return;
      }

      try {
        await currentUser.reload();
        if (!active) {
          return;
        }
        if (currentUser.emailVerified) {
          router.replace("/upload");
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

  function canSubmit() {
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

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit()) {
      return;
    }
    setPending("register");
    setNotice(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth!, email.trim(), password);
      await sendEmailVerification(credential.user, {
        url: getVerificationReturnUrl(),
        handleCodeInApp: false,
      });
      setNotice({ type: "success", text: "验证邮件已发送。请打开邮箱并点击验证链接完成注册。" });
    } catch {
      setNotice({ type: "error", text: "注册失败。该邮箱可能已注册，或 Firebase 配置不可用。" });
    } finally {
      setPending(null);
    }
  }

  async function login() {
    if (!canSubmit()) {
      return;
    }
    setPending("login");
    setNotice(null);
    try {
      const credential = await signInWithEmailAndPassword(auth!, email.trim(), password);
      await credential.user.reload();
      if (!credential.user.emailVerified) {
        await signOut(auth!);
        setNotice({ type: "error", text: "请先前往邮箱完成验证。" });
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setNotice({ type: "error", text: "登录失败，请检查邮箱和密码。" });
    } finally {
      setPending(null);
    }
  }

  async function loginWithGoogle() {
    if (!isFirebaseConfigured() || !auth) {
      setNotice({ type: "error", text: "尚未配置 Firebase 环境变量，请先完成本地配置。" });
      return;
    }
    setPending("google");
    setNotice(null);
    try {
      await signInWithPopup(auth!, new GoogleAuthProvider());
      router.push(nextPath);
      router.refresh();
    } catch {
      setNotice({ type: "error", text: "Google 登录失败，请稍后重试。" });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-7 space-y-6">
      {notice && (
        <p
          role="alert"
          className={`rounded-xl px-4 py-3 text-sm leading-6 ${
            notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {notice.text}
        </p>
      )}
      <form onSubmit={register} className="space-y-4 rounded-2xl border border-indigo-100 p-5">
        <h2 className="text-lg font-semibold text-slate-950">邮箱注册或登录</h2>
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">邮箱</label>
          <input
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
            placeholder="name@example.com"
            type="email"
            autoComplete="email"
          />
        </div>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
          placeholder="密码（至少 6 位）"
          type="password"
          autoComplete="current-password"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="submit" disabled={pending !== null} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {pending === "register" ? "注册中..." : "邮箱注册"}
          </button>
          <button type="button" onClick={() => void login()} disabled={pending !== null} className="rounded-xl border border-indigo-200 bg-white px-4 py-3 font-semibold text-indigo-700 disabled:opacity-60">
            {pending === "login" ? "登录中..." : "邮箱登录"}
          </button>
        </div>
      </form>
      <button type="button" onClick={loginWithGoogle} disabled={pending !== null} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 disabled:opacity-60">
        {pending === "google" ? "Google 登录中..." : "使用 Google 登录"}
      </button>
    </div>
  );
}
