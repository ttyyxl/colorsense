"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProfileSummary } from "@/components/profile/ProfileSummary";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import type { UserStyleProfile } from "@/lib/user-profile-types";

interface LatestDiagnosis {
  id: string;
  seasonType: string | null;
  confidence: number | null;
  source: string | null;
  createdAt: string | null;
}

export default function PortraitProfilePage() {
  return (
    <ProtectedRoute>
      <PortraitProfileContent />
    </ProtectedRoute>
  );
}

function PortraitProfileContent() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<UserStyleProfile | null>(null);
  const [latestDiagnosis, setLatestDiagnosis] = useState<LatestDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!auth?.currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const token = await auth.currentUser.getIdToken();
        const [profileResponse, diagnosisResponse] = await Promise.all([
          fetch("/api/user-profile", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/user-profile/latest-diagnosis", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const profilePayload = (await profileResponse.json()) as { success?: boolean; profile?: UserStyleProfile | null };
        const diagnosisPayload = (await diagnosisResponse.json()) as { success?: boolean; diagnosis?: LatestDiagnosis | null };

        if (!active) {
          return;
        }
        if (!profilePayload.success) {
          throw new Error("读取个人形象问卷失败。");
        }

        setProfile(profilePayload.profile ?? null);
        setLatestDiagnosis(diagnosisPayload.success ? diagnosisPayload.diagnosis ?? null : null);
      } catch {
        if (active) {
          setError("暂时无法读取个人肖像档案，请稍后重试。");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(129,191,233,0.28),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_45%,#f6f2ff_100%)]">
      <Navbar />
      <section className="relative mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-[#81bfe9]/20 blur-3xl" aria-hidden="true" />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-700">个人肖像档案</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">查看你的个人画像信息</h1>
            <p className="mt-4 leading-7 text-slate-600">
              问卷结果和最近一次季型诊断会集中展示在这里，检测页面只保留上传和结果相关内容。
            </p>
          </div>
          {profile && (
            <Link href="/onboarding/style-profile?mode=edit" className="rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              修改问卷
            </Link>
          )}
        </div>

        <div className="mt-8 space-y-8">
          <AccountCard
            email={currentUser?.email ?? ""}
            updatedAt={formatUnknownDate(profile?.updatedAt)}
          />

          {loading && (
            <div className="rounded-2xl border border-indigo-100 bg-white p-6 text-slate-600">
              正在读取个人肖像档案...
            </div>
          )}

          {!loading && error && (
            <section className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-rose-700">
              <h2 className="text-lg font-bold text-rose-900">读取失败</h2>
              <p className="mt-3 leading-7">{error}</p>
            </section>
          )}

          {!loading && !error && !profile && <EmptyQuestionnaireCard />}

          {!loading && !error && profile && (
            <>
              <ProfileSummary profile={profile} />
              <LatestDiagnosisCard diagnosis={latestDiagnosis} />
            </>
          )}
        </div>
      </section>
      <FooterGradient />
    </main>
  );
}

function AccountCard({ email, updatedAt }: { email: string; updatedAt: string }) {
  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">当前账户信息</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoItem label="邮箱" value={email || "未绑定"} />
        <InfoItem label="最近更新时间" value={updatedAt} />
      </div>
    </section>
  );
}

function EmptyQuestionnaireCard() {
  return (
    <section className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-slate-600">
      <h2 className="text-lg font-bold text-slate-950">你还没有完成个人形象问卷</h2>
      <p className="mt-3 leading-7">请先完成个人形象问卷。系统会在你进入诊断流程前自动引导到问卷页面。</p>
    </section>
  );
}

function LatestDiagnosisCard({ diagnosis }: { diagnosis: LatestDiagnosis | null }) {
  if (!diagnosis) {
    return (
      <section className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-slate-600">
        <h2 className="text-lg font-bold text-slate-950">最近一次季型诊断</h2>
        <p className="mt-3 leading-7">暂未找到诊断记录。完成上传诊断后，这里会显示最近一次季型结果。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">最近一次季型诊断</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoItem label="季型" value={diagnosis.seasonType ?? "未识别"} />
        <InfoItem label="置信度" value={diagnosis.confidence === null ? "未记录" : `${Math.round(diagnosis.confidence * 100)}%`} />
        <InfoItem label="诊断时间" value={formatDate(diagnosis.createdAt)} />
      </div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "未记录";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未记录";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUnknownDate(value: unknown) {
  if (!value) {
    return "未记录";
  }
  if (typeof value === "string") {
    return formatDate(value);
  }
  if (value instanceof Date) {
    return formatDate(value.toISOString());
  }
  if (typeof value === "object" && value !== null) {
    const maybeTimestamp = value as { _seconds?: number; seconds?: number; toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return formatDate(maybeTimestamp.toDate().toISOString());
    }
    const seconds = maybeTimestamp._seconds ?? maybeTimestamp.seconds;
    if (typeof seconds === "number") {
      return formatDate(new Date(seconds * 1000).toISOString());
    }
  }
  return "未记录";
}
