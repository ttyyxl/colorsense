"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signUpWithPassword } from "@/lib/auth-client";
import { useAuth } from "@/lib/useAuth";
import { Notice, resolveNextPath, canSubmit } from "./auth-utils";

interface EmailRegisterFormProps {
  nextPath: string;
}

export function EmailRegisterForm({ nextPath }: EmailRegisterFormProps) {
  const router = useRouter();
  const { refreshCurrentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verify, setVerify] = useState<((token: string) => Promise<unknown>) | null>(null);
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
      const outcome = await signUpWithPassword(email, password);
      if (outcome.user && !outcome.verify) {
        await refreshCurrentUser();
        router.push(await resolveNextPath(nextPath));
        router.refresh();
        return;
      }
      setVerify(() => outcome.verify);
      setNotice({ type: "success", text: "注册成功，验证码已发送至邮箱，请输入验证码完成验证。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "注册失败，请稍后重试。" });
    } finally {
      setPending(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verify) {
      return;
    }
    if (!code.trim()) {
      setNotice({ type: "error", text: "请输入邮箱收到的验证码。" });
      return;
    }

    setPending(true);
    setNotice(null);
    try {
      await verify(code.trim());
      await refreshCurrentUser();
      router.push(await resolveNextPath(nextPath));
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "验证失败，请重新输入验证码。" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={verify ? submitCode : register} className="space-y-4 rounded-2xl border border-indigo-100 bg-white/72 p-5 shadow-sm">
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
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          placeholder="name@example.com"
          type="email"
          autoComplete="email"
          disabled={Boolean(verify)}
        />
      </div>
      <div>
        <label htmlFor="password-register" className="mb-2 block text-sm font-semibold text-slate-700">密码</label>
        <input
          id="password-register"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          placeholder="密码（至少 6 位）"
          type="password"
          autoComplete="new-password"
          disabled={Boolean(verify)}
        />
      </div>
      {verify && (
        <div>
          <label htmlFor="code-register" className="mb-2 block text-sm font-semibold text-slate-700">邮箱验证码</label>
          <input
            id="code-register"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
            placeholder="请输入邮件中的验证码"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
      )}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm disabled:opacity-60">
        {pending ? (verify ? "验证中..." : "注册中...") : verify ? "完成验证" : "邮箱注册"}
      </button>
    </form>
  );
}
