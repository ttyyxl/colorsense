"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { Notice, resolveNextPath } from "./auth-utils";

interface GoogleAuthSectionProps {
  nextPath: string;
}

export function GoogleAuthSection({ nextPath }: GoogleAuthSectionProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<boolean>(false);

  async function loginWithGoogle() {
    if (!isFirebaseConfigured() || !auth) {
      setNotice({ type: "error", text: "尚未配置 Firebase 环境变量，请先完成本地配置。" });
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      await signInWithPopup(auth!, new GoogleAuthProvider());
      router.push(await resolveNextPath(nextPath));
      router.refresh();
    } catch {
      setNotice({ type: "error", text: "Google 登录失败，请稍后重试。" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
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
      <button type="button" onClick={loginWithGoogle} disabled={pending} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 disabled:opacity-60">
        {pending ? "Google 登录中..." : "使用 Google 登录"}
      </button>
    </div>
  );
}
