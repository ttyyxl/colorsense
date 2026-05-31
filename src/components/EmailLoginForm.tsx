"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Notice, resolveNextPath, canSubmit } from "./auth-utils";

interface EmailLoginFormProps {
  nextPath: string;
}

export function EmailLoginForm({ nextPath }: EmailLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<boolean>(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit(email, password, setNotice)) {
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const credential = await signInWithEmailAndPassword(auth!, email.trim(), password);
      await credential.user.reload();
      if (!credential.user.emailVerified) {
        await signOut(auth!);
        setNotice({ type: "error", text: "请先前往邮箱完成验证。" });
        return;
      }
      router.push(await resolveNextPath(nextPath));
      router.refresh();
    } catch {
      setNotice({ type: "error", text: "登录失败，请检查邮箱和密码。" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={login} className="space-y-4 rounded-2xl border border-indigo-100 p-5">
      <h2 className="text-lg font-semibold text-slate-950">邮箱登录</h2>
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
      <div>
        <label htmlFor="email-login" className="mb-2 block text-sm font-semibold text-slate-700">邮箱</label>
        <input
          id="email-login"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
          placeholder="name@example.com"
          type="email"
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="password-login" className="mb-2 block text-sm font-semibold text-slate-700">密码</label>
        <input
          id="password-login"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
          placeholder="密码（至少 6 位）"
          type="password"
          autoComplete="current-password"
        />
      </div>
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? "登录中..." : "邮箱登录"}
      </button>
    </form>
  );
}