"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Download, Loader2, Trash2, X } from "lucide-react";
import html2canvas from "html2canvas-pro";
import JSZip from "jszip";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listUserDiagnoses } from "@/lib/firestore-diagnoses";
import { SEASONS } from "@/lib/seasons";
import type { Diagnosis } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useMemo, useState } from "react";

const SCORE_LABELS = {
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  winter: "Winter",
} as const;

type BulkAction = "delete" | "export" | null;

interface BatchDeleteResponse {
  success?: boolean;
  deletedIds?: string[];
  failed?: Array<{ id: string; reason: string }>;
  error?: string;
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG encoding failed"));
      }
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80);
}

function diagnosisPngName(diagnosis: Diagnosis) {
  const created = safeFilePart(diagnosis.createdAt || diagnosis.id);
  return `diagnosis-${diagnosis.seasonType}-${created || diagnosis.id}.png`;
}

function ExportDiagnosisCard({ diagnosis }: { diagnosis: Diagnosis }) {
  const season = SEASONS[diagnosis.seasonType];

  return (
    <div
      id={`export-card-${diagnosis.id}`}
      className="w-[900px] space-y-5 bg-white p-8 text-slate-900"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      <header className="rounded-2xl bg-indigo-600 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-100">ColorSense</p>
        <h2 className="mt-2 text-3xl font-bold">{season.name}</h2>
        <p className="mt-2 text-indigo-100">
          {diagnosis.seasonType} · confidence {Math.round(diagnosis.confidence * 100)}%
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold">Scores</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {Object.entries(SCORE_LABELS).map(([key, label]) => {
            const score = diagnosis.scores?.[key as keyof typeof SCORE_LABELS] ?? 0;
            return (
              <div key={key} className="rounded-xl bg-slate-50 p-3">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span>{Math.round(score * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(score, 1)) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold">Recommended Palette</h3>
        <div className="mt-3 flex gap-3">
          {diagnosis.colorPalette.map((color) => (
            <div key={color} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
              <span className="text-sm">{color}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold">Style Keywords</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {diagnosis.styleKeywords.map((keyword) => (
            <span key={keyword} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
              {keyword}
            </span>
          ))}
        </div>
        <p className="mt-4 leading-7 text-slate-700">{diagnosis.aiDescription}</p>
        <p className="mt-3 text-sm text-slate-600">Avoid: {diagnosis.avoidColors.join(" / ")}</p>
      </section>

      {diagnosis.aiAdvice && (
        <section className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-lg font-bold">AI Advice</h3>
          <p className="mt-2 leading-7 text-slate-700">{diagnosis.aiAdvice.summary}</p>
          <p className="mt-2 text-sm text-slate-600">Clothing: {diagnosis.aiAdvice.clothing.advice}</p>
          <p className="mt-2 text-sm text-slate-600">Makeup: {diagnosis.aiAdvice.makeup.advice}</p>
          <p className="mt-2 text-sm text-slate-600">Avoid: {diagnosis.aiAdvice.avoid}</p>
        </section>
      )}

      {diagnosis.doubaoAdvice && (
        <section className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-lg font-bold">{diagnosis.doubaoAdvice.title}</h3>
          <p className="mt-2 leading-7 text-slate-700">{diagnosis.doubaoAdvice.summary}</p>
          <p className="mt-2 text-sm text-slate-600">Fashion: {diagnosis.doubaoAdvice.fashion_recommendations.join(" / ")}</p>
          <p className="mt-2 text-sm text-slate-600">Makeup: {diagnosis.doubaoAdvice.makeup_recommendations.join(" / ")}</p>
          <p className="mt-2 text-sm text-slate-600">Avoid: {diagnosis.doubaoAdvice.avoid_recommendations.join(" / ")}</p>
        </section>
      )}

      <footer className="text-sm text-slate-500">
        Diagnosis ID: {diagnosis.id} · Created at: {new Date(diagnosis.createdAt).toLocaleString("zh-CN")}
      </footer>
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [exportProgress, setExportProgress] = useState("");

  const selectedDiagnoses = useMemo(
    () => diagnoses.filter((diagnosis) => selectedIds.has(diagnosis.id)),
    [diagnoses, selectedIds],
  );
  const allSelected = diagnoses.length > 0 && selectedIds.size === diagnoses.length;
  const hasSelection = selectedIds.size > 0;
  const isBusy = bulkAction !== null || deletingId !== null;

  function openDiagnosis(id: string) {
    router.push(`/result/${id}`);
  }

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

  function enterBatchMode() {
    setBatchMode(true);
    setSelectedIds(new Set());
    setError("");
    setNotice("");
  }

  function cancelBatchMode() {
    if (isBusy) {
      return;
    }
    setBatchMode(false);
    setSelectedIds(new Set());
    setExportProgress("");
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (diagnoses.length > 0 && current.size === diagnoses.length) {
        return new Set();
      }
      return new Set(diagnoses.map((item) => item.id));
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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
    setNotice("");

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
      setSelectedIds((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
      setNotice("已删除 1 条诊断记录。");
    } catch {
      setError("删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  }

  async function batchDelete() {
    if (!currentUser || selectedIds.size === 0) {
      return;
    }

    const ids = Array.from(selectedIds);
    const confirmed = window.confirm(`确定要删除选中的 ${ids.length} 条诊断记录吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    setBulkAction("delete");
    setError("");
    setNotice("");

    try {
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch("/api/diagnoses/batch-delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      const payload = (await response.json().catch(() => ({}))) as BatchDeleteResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Batch delete failed");
      }

      const deletedIds = payload.deletedIds ?? [];
      const failed = payload.failed ?? [];

      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setDiagnoses((items) => items.filter((item) => !deletedSet.has(item.id)));
        setSelectedIds((items) => {
          const next = new Set(items);
          deletedIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (failed.length > 0) {
        setError(`部分记录删除失败：${failed.map((item) => `${item.id}(${item.reason})`).join("，")}`);
      } else {
        setNotice(`已删除 ${deletedIds.length} 条诊断记录。`);
        setSelectedIds(new Set());
        setBatchMode(false);
      }
    } catch {
      setError("批量删除失败，请稍后重试。");
    } finally {
      setBulkAction(null);
    }
  }

  async function batchExport() {
    if (selectedDiagnoses.length === 0) {
      return;
    }

    setBulkAction("export");
    setError("");
    setNotice("");

    try {
      await waitForPaint();
      const zip = new JSZip();

      for (let index = 0; index < selectedDiagnoses.length; index += 1) {
        const diagnosis = selectedDiagnoses[index];
        setExportProgress(`正在导出 ${index + 1} / ${selectedDiagnoses.length}`);
        const element = document.getElementById(`export-card-${diagnosis.id}`);

        if (!element) {
          throw new Error(`Export card not found: ${diagnosis.id}`);
        }

        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: process.env.NODE_ENV !== "production",
        });
        const blob = await canvasToBlob(canvas);
        zip.file(diagnosisPngName(diagnosis), blob);
      }

      setExportProgress("正在打包 ZIP...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `colorsense-diagnoses-export-${formatDateStamp()}.zip`);
      setNotice(`已导出 ${selectedDiagnoses.length} 条诊断记录。`);
    } catch (err) {
      console.error("[history-batch-export] Export failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      setError("批量导出失败，请稍后重试。");
    } finally {
      setBulkAction(null);
      setExportProgress("");
    }
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
        <Navbar />
        <section className="mx-auto max-w-4xl px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-700">P06 历史记录</p>
              <h1 className="mt-2 text-4xl font-bold text-slate-950">你的诊断记录</h1>
            </div>
            {!isLoading && diagnoses.length > 0 && !batchMode && (
              <button
                type="button"
                onClick={enterBatchMode}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
                批量操作
              </button>
            )}
          </div>

          {error && <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {notice && <p className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

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

          {batchMode && diagnoses.length > 0 && (
            <div className="mt-8 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={allSelected} disabled={isBusy} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" />
                  全选
                </label>
                <span className="text-sm text-slate-500">已选择 {selectedIds.size} 条记录</span>
                {exportProgress && <span className="text-sm font-medium text-indigo-700">{exportProgress}</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void batchDelete()}
                  disabled={!hasSelection || isBusy}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkAction === "delete" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                  {bulkAction === "delete" ? "删除中..." : "确认删除"}
                </button>
                <button
                  type="button"
                  onClick={() => void batchExport()}
                  disabled={!hasSelection || isBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {bulkAction === "export" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                  {bulkAction === "export" ? "导出中..." : "批量导出"}
                </button>
                <button
                  type="button"
                  onClick={cancelBatchMode}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-4">
            {diagnoses.map((diagnosis) => {
              const season = SEASONS[diagnosis.seasonType];
              const isDeleting = deletingId === diagnosis.id;
              const isSelected = selectedIds.has(diagnosis.id);

              return (
                <article
                  key={diagnosis.id}
                  role={batchMode ? undefined : "link"}
                  tabIndex={batchMode ? -1 : 0}
                  aria-label={batchMode ? undefined : `查看 ${season.name} 诊断详情`}
                  onClick={() => {
                    if (!batchMode) {
                      openDiagnosis(diagnosis.id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (batchMode) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDiagnosis(diagnosis.id);
                    }
                  }}
                  className={`rounded-2xl border bg-white p-5 shadow-sm outline-none transition ${
                    isSelected ? "border-indigo-400" : "border-slate-200"
                  } ${batchMode ? "" : "cursor-pointer hover:border-indigo-300 hover:shadow-md focus:ring-2 focus:ring-indigo-200"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {batchMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isBusy}
                          onChange={() => toggleOne(diagnosis.id)}
                          className="mt-2 h-4 w-4 rounded border-slate-300"
                          aria-label={`选择 ${season.name} 诊断记录`}
                        />
                      )}
                      <div>
                        <p className="text-sm text-slate-500">{new Date(diagnosis.createdAt).toLocaleString("zh-CN")}</p>
                        <h2 className="mt-1 text-2xl font-bold text-slate-950">
                          {season.emoji} {season.name}
                        </h2>
                      </div>
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

                  <div className="mt-5 flex flex-wrap gap-3" onClick={(event) => event.stopPropagation()}>
                    <Link
                      href={`/result/${diagnosis.id}`}
                      aria-disabled={batchMode}
                      onClick={(event) => {
                        if (batchMode) {
                          event.preventDefault();
                        }
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                        batchMode ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-indigo-600 text-white"
                      }`}
                    >
                      查看结果
                    </Link>
                    {!batchMode && (
                      <button
                        type="button"
                        onClick={() => void removeDiagnosis(diagnosis.id)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                        {isDeleting ? "删除中..." : "删除记录"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden="true">
            {selectedDiagnoses.map((diagnosis) => (
              <ExportDiagnosisCard key={diagnosis.id} diagnosis={diagnosis} />
            ))}
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}
