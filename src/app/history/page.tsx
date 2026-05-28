"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listUserDiagnoses } from "@/lib/firestore-diagnoses";
import { SEASONS } from "@/lib/seasons";
import type { Diagnosis } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useState } from "react";

export default function HistoryPage() {
  const { currentUser } = useAuth();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      if (!currentUser) {
        return;
      }

      try {
        setDiagnoses(await listUserDiagnoses(currentUser.uid));
      } catch {
        setError("历史记录读取失败，请检查 Firestore 配置或稍后重试。");
      } finally {
        setIsLoading(false);
      }
    }

    void loadHistory();
  }, [currentUser]);

  async function removeDiagnosis(id: string) {
    if (!currentUser) {
      setError("登录已过期，请重新登录后再删除记录。");
      return;
    }

    const confirmed = window.confirm("确定要删除这条诊断记录吗？删除后无法在历史记录中查看。");
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setError("");

    try {
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch(`/api/diagnoses/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };

      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error ?? "Delete failed");
      }

      setDiagnoses((items) => items.filter((item) => item.id !== id));
    } catch {
      setError("删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
        <Navbar />
        <section className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-sm font-semibold text-indigo-700">P06 历史记录</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">你的诊断记录</h1>

          {error && <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {isLoading && <div className="mt-8 rounded-2xl border border-indigo-100 bg-white p-6 text-slate-600">正在读取历史记录...</div>}

          {!isLoading && diagnoses.length === 0 && (
            <div className="mt-8 rounded-2xl border border-indigo-100 bg-white p-6">
              <h2 className="text-2xl font-bold text-slate-950">还没有诊断记录</h2>
              <p className="mt-3 text-slate-600">上传一张正面照后，这里会显示你的历史诊断。</p>
              <Link href="/upload" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">
                开始第一次诊断
              </Link>
            </div>
          )}

          <div className="mt-8 grid gap-4">
            {diagnoses.map((diagnosis) => {
              const season = SEASONS[diagnosis.seasonType];
              const isDeleting = deletingId === diagnosis.id;

              return (
                <article key={diagnosis.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">{new Date(diagnosis.createdAt).toLocaleString("zh-CN")}</p>
                      <h2 className="mt-1 text-2xl font-bold text-slate-950">
                        {season.emoji} {season.name}
                      </h2>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                      {Math.round(diagnosis.confidence * 100)}%
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {diagnosis.colorPalette.map((color) => (
                      <span key={color} className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/result/${diagnosis.id}`} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
                      查看结果
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removeDiagnosis(diagnosis.id)}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                      {isDeleting ? "删除中..." : "删除记录"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}
