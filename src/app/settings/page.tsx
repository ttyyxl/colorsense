"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { KeyRound, LogOut } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/useAuth";

type Notice = { type: "success" | "error"; text: string } | null;

const TEXT = {
  loginExpiredChangePassword: "\u767b\u5f55\u72b6\u6001\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u518d\u4fee\u6539\u5bc6\u7801\u3002",
  newPasswordRequired: "\u65b0\u5bc6\u7801\u4e0d\u80fd\u4e3a\u7a7a\u3002",
  newPasswordShort: "\u65b0\u5bc6\u7801\u81f3\u5c11\u9700\u8981 6 \u4f4d\u3002",
  passwordMismatch: "\u4e24\u6b21\u8f93\u5165\u7684\u65b0\u5bc6\u7801\u4e0d\u4e00\u81f4\u3002",
  passwordUpdated: "\u5bc6\u7801\u5df2\u66f4\u65b0\u3002\u4e0b\u6b21\u767b\u5f55\u8bf7\u4f7f\u7528\u65b0\u5bc6\u7801\u3002",
  currentPasswordWrong: "\u5f53\u524d\u5bc6\u7801\u4e0d\u6b63\u786e\uff0c\u8bf7\u91cd\u65b0\u8f93\u5165\u3002",
  passwordUpdateFailed: "\u5bc6\u7801\u4fee\u6539\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",
  updating: "\u66f4\u65b0\u4e2d...",
  updatePassword: "\u66f4\u65b0\u5bc6\u7801",
  loggingOut: "\u9000\u51fa\u4e2d...",
  logout: "\u9000\u51fa\u767b\u5f55",
};

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice(null);

    if (!currentUser || !currentUser.email) {
      setPasswordNotice({ type: "error", text: TEXT.loginExpiredChangePassword });
      return;
    }
    if (!newPassword) {
      setPasswordNotice({ type: "error", text: TEXT.newPasswordRequired });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordNotice({ type: "error", text: TEXT.newPasswordShort });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: "error", text: TEXT.passwordMismatch });
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice({ type: "success", text: TEXT.passwordUpdated });
    } catch (error) {
      setPasswordNotice({ type: "error", text: getPasswordErrorMessage(error) });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(129,191,233,0.28),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_45%,#f6f2ff_100%)]">
      <Navbar />
      <section className="relative mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-[#81bfe9]/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="text-sm font-semibold text-indigo-700">&#x8d26;&#x6237;&#x8bbe;&#x7f6e;</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">&#x7ba1;&#x7406;&#x4f60;&#x7684; ColorSense &#x8d26;&#x6237;</h1>
          <p className="mt-4 leading-7 text-slate-600">&#x66f4;&#x65b0;&#x8d26;&#x6237;&#x5bc6;&#x7801;&#xff0c;&#x6216;&#x9000;&#x51fa;&#x5f53;&#x524d;&#x767b;&#x5f55;&#x72b6;&#x6001;&#x3002;</p>
        </div>

        <div className="relative mt-8 grid gap-6">
          <form onSubmit={changePassword} className="rounded-2xl border border-indigo-100 bg-white/80 p-6 shadow-sm backdrop-blur">
            <SectionHeading icon={<KeyRound className="h-5 w-5" aria-hidden="true" />} title={<>&#x4fee;&#x6539;&#x5bc6;&#x7801;</>} description={<>&#x4fee;&#x6539;&#x524d;&#x9700;&#x8981;&#x9a8c;&#x8bc1;&#x5f53;&#x524d;&#x5bc6;&#x7801;&#x3002;&#x5bc6;&#x7801;&#x53ea;&#x7531; Firebase Auth &#x5904;&#x7406;&#xff0c;&#x4e0d;&#x4f1a;&#x4fdd;&#x5b58;&#x5230;&#x6570;&#x636e;&#x5e93;&#x3002;</>} />
            {passwordNotice && <NoticeMessage notice={passwordNotice} />}
            <div className="mt-5 grid gap-4">
              <PasswordField label={<>&#x5f53;&#x524d;&#x5bc6;&#x7801;</>} value={currentPassword} autoComplete="current-password" onChange={setCurrentPassword} />
              <div className="grid gap-4 md:grid-cols-2">
                <PasswordField label={<>&#x65b0;&#x5bc6;&#x7801;</>} value={newPassword} autoComplete="new-password" onChange={setNewPassword} />
                <PasswordField label={<>&#x786e;&#x8ba4;&#x65b0;&#x5bc6;&#x7801;</>} value={confirmPassword} autoComplete="new-password" onChange={setConfirmPassword} />
              </div>
              <button type="submit" disabled={savingPassword} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 md:w-fit">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {savingPassword ? TEXT.updating : TEXT.updatePassword}
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-rose-100 bg-white/80 p-6 shadow-sm backdrop-blur">
            <SectionHeading icon={<LogOut className="h-5 w-5" aria-hidden="true" />} title={<>&#x9000;&#x51fa;&#x767b;&#x5f55;</>} description={<>&#x9000;&#x51fa;&#x540e;&#x53f3;&#x4e0a;&#x89d2;&#x4f1a;&#x6062;&#x590d;&#x4e3a;&#x767b;&#x5f55;/&#x6ce8;&#x518c;&#x5165;&#x53e3;&#x3002;</>} />
            <button type="button" onClick={handleLogout} disabled={loggingOut} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 md:w-fit">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {loggingOut ? TEXT.loggingOut : TEXT.logout}
            </button>
          </section>
        </div>
      </section>
      <FooterGradient />
    </main>
  );
}

function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: React.ReactNode; description: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 rounded-xl bg-indigo-50 p-2 text-indigo-700">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function NoticeMessage({ notice }: { notice: Exclude<Notice, null> }) {
  return (
    <p role="alert" className={`mt-4 rounded-xl px-4 py-3 text-sm leading-6 ${notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {notice.text}
    </p>
  );
}

function PasswordField({ label, value, autoComplete, onChange }: { label: React.ReactNode; value: string; autoComplete: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
        type="password"
        autoComplete={autoComplete}
      />
    </label>
  );
}

function getPasswordErrorMessage(error: unknown) {
  const errorCode = getErrorCode(error);
  if (errorCode === "auth/wrong-password" || errorCode === "auth/invalid-credential") {
    return TEXT.currentPasswordWrong;
  }
  if (errorCode === "auth/weak-password") {
    return TEXT.newPasswordShort;
  }
  if (errorCode === "auth/requires-recent-login" || errorCode === "auth/user-token-expired") {
    return TEXT.loginExpiredChangePassword;
  }
  return TEXT.passwordUpdateFailed;
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}
