"use client";

import { FormEvent, useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Notice, getVerificationReturnUrl, canSubmit } from "./auth-utils";

interface EmailRegisterFormProps {
  nextPath: string;
}

export function EmailRegisterForm({ nextPath }: EmailRegisterFormProps) {
  void nextPath;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<boolean>(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit(email, password, setNotice)) {
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth!, email.trim(), password);
      await sendEmailVerification(credential.user, {
        url: getVerificationReturnUrl(),
        handleCodeInApp: false,
      });
      setNotice({ type: "success", text: "验证邮件已发送。请打开邮箱并点击验证链接完成注册。" });
    } catch (error) {
      const errorCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      setNotice({
        type: "error",
        text: errorCode === "auth/email-already-in-use" ? "该账号已注册，请登录。" : "注册失败。请检查网络、邮箱格式或 Firebase 配置后重试。",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={register} className="space-y-4 rounded-2xl border border-indigo-100 bg-white/72 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">邮箱注册</h2>
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
        <label htmlFor="email-register" className="mb-2 block text-sm font-semibold text-slate-700">邮箱</label>
        <input
          id="email-register"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
          placeholder="name@example.com"
          type="email"
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="password-register" className="mb-2 block text-sm font-semibold text-slate-700">密码</label>
        <input
          id="password-register"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
          placeholder="密码（至少 6 位）"
          type="password"
          autoComplete="new-password"
        />
      </div>
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm disabled:opacity-60">
        {pending ? "注册中..." : "邮箱注册"}
      </button>
    </form>
  );
}
