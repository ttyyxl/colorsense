"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProfileSummary } from "@/components/profile/ProfileSummary";
import { StyleProfileForm } from "@/components/profile/StyleProfileForm";
import { auth } from "@/lib/firebase";
import type { UserStyleProfile } from "@/lib/user-profile-types";

interface LatestDiagnosis {
  id: string;
  seasonType: string | null;
  confidence: number | null;
  source: string | null;
  createdAt: string | null;
}

export default function ProfileStylePage() {
  return (
    <ProtectedRoute>
      <ProfileStyleContent />
    </ProtectedRoute>
  );
}

function ProfileStyleContent() {
  const [profile, setProfile] = useState<UserStyleProfile | null>(null);
  const [latestDiagnosis, setLatestDiagnosis] = useState<LatestDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  async function loadProfile() {
    if (!auth?.currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
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

      if (profilePayload.success) {
        setProfile(profilePayload.profile ?? null);
      }
      if (diagnosisPayload.success) {
        setLatestDiagnosis(diagnosisPayload.diagnosis ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm font-semibold text-indigo-700">个人肖像档案</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">查看你的个人画像信息</h1>
            <p className="mt-4 leading-7 text-slate-600">
              这里集中展示问卷结果和最近一次季型诊断。编辑问卷不会修改已有诊断记录。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm"
          >
            {editing ? "收起编辑" : "编辑问卷"}
          </button>
        </div>

        <div className="mt-8 space-y-8">
          {loading ? (
            <div className="rounded-2xl border border-indigo-100 bg-white p-6 text-slate-600">正在读取个人肖像档案...</div>
          ) : (
            <>
              <ProfileSummary profile={profile} />
              <LatestDiagnosisCard diagnosis={latestDiagnosis} />
            </>
          )}

          {(editing || !profile) && (
            <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">编辑个人形象问卷</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">这里只更新问卷信息，不会修改历史诊断记录。</p>
              <div className="mt-6">
                <StyleProfileForm
                  submitLabel="保存修改"
                  onSaved={() => {
                    setEditing(false);
                    void loadProfile();
                  }}
                />
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
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
        <DiagnosisItem label="季型" value={diagnosis.seasonType ?? "未识别"} />
        <DiagnosisItem label="置信度" value={diagnosis.confidence === null ? "未记录" : `${Math.round(diagnosis.confidence * 100)}%`} />
        <DiagnosisItem label="诊断时间" value={formatDate(diagnosis.createdAt)} />
      </div>
    </section>
  );
}

function DiagnosisItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
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
