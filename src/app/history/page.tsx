"use client";

import { useRouter } from "next/navigation";
import { CheckSquare, Download, History, Loader2, Shirt, Trash2, X } from "lucide-react";
import html2canvas from "html2canvas-pro";
import JSZip from "jszip";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FooterGradient } from "@/components/home/FooterGradient";
import { listUserDiagnoses } from "@/lib/firestore-diagnoses";
import { SEASONS } from "@/lib/seasons";
import type { Diagnosis } from "@/lib/types";
import type { OutfitHistoryRecord, OutfitHistorySummary } from "@/lib/outfit-types";
import { useAuth } from "@/lib/useAuth";

const SCORE_LABELS = {
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  winter: "Winter",
} as const;

type HistoryTab = "diagnoses" | "outfits";
type BulkAction = "delete" | "export" | null;

interface BatchDeleteResponse {
  success?: boolean;
  deletedIds?: string[];
  failed?: Array<{ id: string; reason: string }>;
  error?: string;
}

interface OutfitListResponse {
  success?: boolean;
  records?: OutfitHistorySummary[];
  error?: string;
}

interface OutfitDetailResponse {
  success?: boolean;
  record?: OutfitHistoryRecord;
  error?: string;
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encoding failed"));
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

function outfitPngName(record: OutfitHistorySummary) {
  const created = safeFilePart(record.createdAt || record.id);
  return `outfit-${safeFilePart(record.theme || record.id)}-${created || record.id}.png`;
}

function ExportDiagnosisCard({ diagnosis }: { diagnosis: Diagnosis }) {
  const season = SEASONS[diagnosis.seasonType];
  return (
    <div id={`export-card-${diagnosis.id}`} className="w-[900px] space-y-5 bg-white p-8 text-slate-900" style={{ fontFamily: "Arial, sans-serif" }}>
      <header className="rounded-2xl bg-indigo-600 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-100">ColorSense</p>
        <h2 className="mt-2 text-3xl font-bold">{season.name}</h2>
        <p className="mt-2 text-indigo-100">
          {diagnosis.seasonType} / confidence {Math.round(diagnosis.confidence * 100)}%
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
        <div className="mt-3 flex flex-wrap gap-3">
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
        Diagnosis ID: {diagnosis.id} / Created at: {new Date(diagnosis.createdAt).toLocaleString("zh-CN")}
      </footer>
    </div>
  );
}

function ExportOutfitCard({ record }: { record: OutfitHistorySummary }) {
  return (
    <div id={`export-outfit-card-${record.id}`} className="w-[900px] space-y-5 bg-white p-8 text-slate-900" style={{ fontFamily: "Arial, sans-serif" }}>
      <header className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-100">ColorSense</p>
        <h2 className="mt-2 text-3xl font-bold">{record.theme || "穿搭日记"}</h2>
        <p className="mt-2 text-indigo-100">
          {record.season || "未知季型"} / {record.occasion || "未知场合"} / {record.mood || "未知心情"}
        </p>
      </header>

      {record.imageUrl ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img src={record.imageUrl} alt="" className="block h-auto w-full" />
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold">穿搭摘要</h3>
        <p className="mt-3 leading-7 text-slate-700">
          {record.city ? `${record.city} / ` : ""}
          {record.scene === "travel" ? "旅行" : "日常"}场景下的穿搭日记，围绕 {record.occasion || "场合"} 和 {record.mood || "心情"} 生成。
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold">推荐色彩</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {record.colorPalette.map((color) => (
            <div key={color} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
              <span className="text-sm">{color}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-sm text-slate-500">Record ID: {record.id} / Created at: {new Date(record.createdAt).toLocaleString("zh-CN")}</footer>
    </div>
  );
}

function BatchToolbar({
  selectedCount,
  exportProgress,
  isBusy,
  onToggleAll,
  allSelected,
  onDelete,
  onExport,
  onCancel,
  deleteLabel,
  exportLabel,
}: {
  selectedCount: number;
  exportProgress: string;
  isBusy: boolean;
  onToggleAll: () => void;
  allSelected: boolean;
  onDelete: () => void;
  onExport: () => void;
  onCancel: () => void;
  deleteLabel: string;
  exportLabel: string;
}) {
  return (
    <div className="mt-6 glass-card rounded-[20px] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={allSelected} disabled={isBusy} onChange={onToggleAll} className="h-4 w-4 rounded border-slate-300" />
          全选
        </label>
        <span className="text-sm text-slate-500">已选择 {selectedCount} 条记录</span>
        {exportProgress && <span className="text-sm font-medium text-indigo-700">{exportProgress}</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={selectedCount === 0 || isBusy}
          className="inline-flex items-center gap-2 glass-card rounded-[12px] border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {deleteLabel}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={selectedCount === 0 || isBusy}
          className="inline-flex items-center gap-2 rounded-[12px] bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exportLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="inline-flex items-center gap-2 glass-card rounded-[12px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          取消
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-indigo-600 text-white shadow-sm" : "glass-card text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<HistoryTab>("diagnoses");
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(true);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [diagnosisNotice, setDiagnosisNotice] = useState("");
  const [diagnosisBatchMode, setDiagnosisBatchMode] = useState(false);
  const [selectedDiagnosisIds, setSelectedDiagnosisIds] = useState<Set<string>>(new Set());
  const [diagnosisBulkAction, setDiagnosisBulkAction] = useState<BulkAction>(null);
  const [diagnosisExportProgress, setDiagnosisExportProgress] = useState("");
  const [deletingDiagnosisId, setDeletingDiagnosisId] = useState<string | null>(null);

  const [outfitRecords, setOutfitRecords] = useState<OutfitHistorySummary[]>([]);
  const [outfitLoading, setOutfitLoading] = useState(false);
  const [outfitError, setOutfitError] = useState("");
  const [outfitNotice, setOutfitNotice] = useState("");
  const [outfitBatchMode, setOutfitBatchMode] = useState(false);
  const [selectedOutfitIds, setSelectedOutfitIds] = useState<Set<string>>(new Set());
  const [outfitBulkAction, setOutfitBulkAction] = useState<BulkAction>(null);
  const [outfitExportProgress, setOutfitExportProgress] = useState("");
  const [deletingOutfitId, setDeletingOutfitId] = useState<string | null>(null);

  const selectedDiagnoses = useMemo(() => diagnoses.filter((item) => selectedDiagnosisIds.has(item.id)), [diagnoses, selectedDiagnosisIds]);
  const allDiagnosesSelected = diagnoses.length > 0 && selectedDiagnosisIds.size === diagnoses.length;
  const diagnosisBusy = diagnosisBulkAction !== null || deletingDiagnosisId !== null;

  const selectedOutfits = useMemo(() => outfitRecords.filter((item) => selectedOutfitIds.has(item.id)), [outfitRecords, selectedOutfitIds]);
  const allOutfitsSelected = outfitRecords.length > 0 && selectedOutfitIds.size === outfitRecords.length;
  const outfitBusy = outfitBulkAction !== null || deletingOutfitId !== null;

  async function loadDiagnoses() {
    if (!currentUser) return;
    setDiagnosisLoading(true);
    setDiagnosisError("");
    try {
      setDiagnoses(await listUserDiagnoses(currentUser.uid));
    } catch {
      setDiagnosisError("历史诊断记录读取失败，请检查 Firestore 配置或稍后重试。");
    } finally {
      setDiagnosisLoading(false);
    }
  }

  async function loadOutfitRecords() {
    if (!currentUser) return;
    setOutfitLoading(true);
    setOutfitError("");
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/outfit-records", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as OutfitListResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "OUTFIT_LIST_FAILED");
      setOutfitRecords(payload.records ?? []);
    } catch {
      setOutfitError("穿搭日记读取失败，请稍后重试。");
    } finally {
      setOutfitLoading(false);
    }
  }

  useEffect(() => {
    void loadDiagnoses();
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === "outfits" && outfitRecords.length === 0 && !outfitLoading) {
      void loadOutfitRecords();
    }
  }, [activeTab, currentUser]);

  function openDiagnosis(id: string) {
    if (!id) {
      setDiagnosisError("这条诊断记录暂时无法打开结果页。");
      return;
    }
    router.push(`/result/${id}`);
  }

  async function openOutfitRecord(id: string) {
    if (!id) {
      setOutfitError("这条穿搭日记暂时无法打开结果页。");
      return;
    }
    if (!currentUser) {
      setOutfitError("登录状态已过期，请重新登录后再查看穿搭日记。");
      return;
    }

    setOutfitError("");
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch(`/api/outfit-records/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as OutfitDetailResponse;
      if (!response.ok || !payload.success || !payload.record) {
        throw new Error(payload.error ?? "OUTFIT_DETAIL_FAILED");
      }

      sessionStorage.setItem(
        "colorsense-outfit-result",
        JSON.stringify({
          request: payload.record.request,
          result: payload.record.result,
          source: payload.record.source,
          outfitId: payload.record.outfitId ?? payload.record.id,
          resultId: payload.record.resultId ?? payload.record.id,
          imageUrl: payload.record.imageUrl,
          createdAt: payload.record.createdAt,
        }),
      );
      router.push("/outfit/result");
    } catch {
      setOutfitError("穿搭日记详情读取失败，暂时无法跳转到结果页。");
    }
  }

  function enterDiagnosisBatchMode() {
    setDiagnosisBatchMode(true);
    setSelectedDiagnosisIds(new Set());
    setDiagnosisError("");
    setDiagnosisNotice("");
  }

  function cancelDiagnosisBatchMode() {
    if (diagnosisBusy) return;
    setDiagnosisBatchMode(false);
    setSelectedDiagnosisIds(new Set());
    setDiagnosisExportProgress("");
  }

  function toggleAllDiagnoses() {
    setSelectedDiagnosisIds((current) => {
      if (diagnoses.length > 0 && current.size === diagnoses.length) return new Set();
      return new Set(diagnoses.map((item) => item.id));
    });
  }

  function toggleDiagnosisOne(id: string) {
    setSelectedDiagnosisIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeDiagnosis(id: string) {
    if (!currentUser) {
      setDiagnosisError("登录已过期，请重新登录后再删除记录。");
      return;
    }
    if (!window.confirm("确定要删除这条诊断记录吗？删除后将无法在历史记录中查看。")) return;

    setDeletingDiagnosisId(id);
    setDiagnosisError("");
    setDiagnosisNotice("");
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch(`/api/diagnoses/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || payload.success !== true) throw new Error(payload.error ?? "Delete failed");
      setDiagnoses((items) => items.filter((item) => item.id !== id));
      setSelectedDiagnosisIds((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
      setDiagnosisNotice("已删除 1 条诊断记录。");
    } catch {
      setDiagnosisError("删除失败，请稍后重试。");
    } finally {
      setDeletingDiagnosisId(null);
    }
  }

  async function batchDeleteDiagnoses() {
    if (!currentUser || selectedDiagnosisIds.size === 0) return;
    const ids = Array.from(selectedDiagnosisIds);
    if (!window.confirm(`确定要删除选中的 ${ids.length} 条诊断记录吗？此操作不可恢复。`)) return;

    setDiagnosisBulkAction("delete");
    setDiagnosisError("");
    setDiagnosisNotice("");
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/diagnoses/batch-delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      const payload = (await response.json().catch(() => ({}))) as BatchDeleteResponse;
      if (!response.ok) throw new Error(payload.error ?? "Batch delete failed");

      const deletedIds = payload.deletedIds ?? [];
      const failed = payload.failed ?? [];
      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setDiagnoses((items) => items.filter((item) => !deletedSet.has(item.id)));
        setSelectedDiagnosisIds((items) => {
          const next = new Set(items);
          deletedIds.forEach((itemId) => next.delete(itemId));
          return next;
        });
      }
      if (failed.length > 0) {
        setDiagnosisError(`部分记录删除失败：${failed.map((item) => `${item.id}(${item.reason})`).join("，")}`);
      } else {
        setDiagnosisNotice(`已删除 ${deletedIds.length} 条诊断记录。`);
        setSelectedDiagnosisIds(new Set());
        setDiagnosisBatchMode(false);
      }
    } catch {
      setDiagnosisError("批量删除失败，请稍后重试。");
    } finally {
      setDiagnosisBulkAction(null);
    }
  }

  async function batchExportDiagnoses() {
    if (selectedDiagnoses.length === 0) return;
    setDiagnosisBulkAction("export");
    setDiagnosisError("");
    setDiagnosisNotice("");
    try {
      await waitForPaint();
      const zip = new JSZip();
      for (let index = 0; index < selectedDiagnoses.length; index += 1) {
        const diagnosis = selectedDiagnoses[index];
        setDiagnosisExportProgress(`正在导出 ${index + 1} / ${selectedDiagnoses.length}`);
        const element = document.getElementById(`export-card-${diagnosis.id}`);
        if (!element) throw new Error(`Export card not found: ${diagnosis.id}`);
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: process.env.NODE_ENV !== "production",
        });
        zip.file(diagnosisPngName(diagnosis), await canvasToBlob(canvas));
      }
      setDiagnosisExportProgress("正在打包 ZIP...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `colorsense-diagnoses-export-${formatDateStamp()}.zip`);
      setDiagnosisNotice(`已导出 ${selectedDiagnoses.length} 条诊断记录。`);
    } catch (error) {
      console.error("[history-batch-export] Export failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setDiagnosisError("批量导出失败，请稍后重试。");
    } finally {
      setDiagnosisBulkAction(null);
      setDiagnosisExportProgress("");
    }
  }

  function enterOutfitBatchMode() {
    setOutfitBatchMode(true);
    setSelectedOutfitIds(new Set());
    setOutfitError("");
    setOutfitNotice("");
  }

  function cancelOutfitBatchMode() {
    if (outfitBusy) return;
    setOutfitBatchMode(false);
    setSelectedOutfitIds(new Set());
    setOutfitExportProgress("");
  }

  function toggleAllOutfits() {
    setSelectedOutfitIds((current) => {
      if (outfitRecords.length > 0 && current.size === outfitRecords.length) return new Set();
      return new Set(outfitRecords.map((item) => item.id));
    });
  }

  function toggleOutfitOne(id: string) {
    setSelectedOutfitIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeOutfitRecord(id: string) {
    if (!currentUser) {
      setOutfitError("登录已过期，请重新登录后再删除穿搭日记。");
      return;
    }
    if (!window.confirm("确定要删除这条穿搭日记吗？删除后将无法在历史记录中查看。")) return;

    setDeletingOutfitId(id);
    setOutfitError("");
    setOutfitNotice("");
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch(`/api/outfit-records/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || payload.success !== true) throw new Error(payload.error ?? "Delete failed");
      setOutfitRecords((items) => items.filter((item) => item.id !== id));
      setSelectedOutfitIds((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
      setOutfitNotice("已删除 1 条穿搭日记。");
    } catch {
      setOutfitError("删除失败，请稍后重试。");
    } finally {
      setDeletingOutfitId(null);
    }
  }

  async function batchDeleteOutfits() {
    if (!currentUser || selectedOutfitIds.size === 0) return;
    const ids = Array.from(selectedOutfitIds);
    if (!window.confirm(`确定要删除选中的 ${ids.length} 条穿搭日记吗？此操作不可恢复。`)) return;

    setOutfitBulkAction("delete");
    setOutfitError("");
    setOutfitNotice("");
    const deletedIds: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    try {
      const token = await currentUser.getIdToken(true);
      for (const id of ids) {
        const response = await fetch(`/api/outfit-records/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (response.ok && payload.success === true) deletedIds.push(id);
        else failed.push({ id, reason: payload.error ?? "delete_failed" });
      }

      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setOutfitRecords((items) => items.filter((item) => !deletedSet.has(item.id)));
        setSelectedOutfitIds((items) => {
          const next = new Set(items);
          deletedIds.forEach((itemId) => next.delete(itemId));
          return next;
        });
      }

      if (failed.length > 0) {
        setOutfitError(`部分穿搭日记删除失败：${failed.map((item) => `${item.id}(${item.reason})`).join("，")}`);
      } else {
        setOutfitNotice(`已删除 ${deletedIds.length} 条穿搭日记。`);
        setSelectedOutfitIds(new Set());
        setOutfitBatchMode(false);
      }
    } catch {
      setOutfitError("批量删除失败，请稍后重试。");
    } finally {
      setOutfitBulkAction(null);
    }
  }

  async function batchExportOutfits() {
    if (selectedOutfits.length === 0) return;
    setOutfitBulkAction("export");
    setOutfitError("");
    setOutfitNotice("");
    try {
      await waitForPaint();
      const zip = new JSZip();
      for (let index = 0; index < selectedOutfits.length; index += 1) {
        const record = selectedOutfits[index];
        setOutfitExportProgress(`正在导出 ${index + 1} / ${selectedOutfits.length}`);
        const element = document.getElementById(`export-outfit-card-${record.id}`);
        if (!element) throw new Error(`Export card not found: ${record.id}`);
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: process.env.NODE_ENV !== "production",
        });
        zip.file(outfitPngName(record), await canvasToBlob(canvas));
      }
      setOutfitExportProgress("正在打包 ZIP...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `colorsense-outfit-diary-export-${formatDateStamp()}.zip`);
      setOutfitNotice(`已导出 ${selectedOutfits.length} 条穿搭日记。`);
    } catch (error) {
      console.error("[history-outfit-export] Export failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setOutfitError("批量导出失败，请稍后重试。");
    } finally {
      setOutfitBulkAction(null);
      setOutfitExportProgress("");
    }
  }

  return (
    <ProtectedRoute>
      <main className="home-dashboard-shell min-h-screen">
        <Navbar />
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mt-2 text-4xl font-extrabold leading-tight text-[#181698]">历史记录</h1>
            </div>
          </div>

          {/* 标签页和批量操作按钮在同一行 */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {/* 左侧标签组 */}
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
              <TabButton active={activeTab === "diagnoses"} icon={<History className="h-4 w-4" aria-hidden="true" />} label="诊断记录" onClick={() => setActiveTab("diagnoses")} />
              <TabButton active={activeTab === "outfits"} icon={<Shirt className="h-4 w-4" aria-hidden="true" />} label="穿搭日记" onClick={() => setActiveTab("outfits")} />
            </div>

            {/* 右侧批量操作按钮（仅在非批量模式且有数据时显示） */}
            {activeTab === "diagnoses" && !diagnosisBatchMode && diagnoses.length > 0 && (
              <button
                type="button"
                onClick={enterDiagnosisBatchMode}
                className="inline-flex items-center gap-2 glass-card rounded-[12px] px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
                批量操作
              </button>
            )}

            {activeTab === "outfits" && !outfitBatchMode && outfitRecords.length > 0 && (
              <button
                type="button"
                onClick={enterOutfitBatchMode}
                className="inline-flex items-center gap-2 glass-card rounded-[12px] px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
                批量操作
              </button>
            )}
          </div>

          {activeTab === "diagnoses" ? (
            <div className="mt-6">
              {diagnosisError && <p className="glass-card rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{diagnosisError}</p>}
              {diagnosisNotice && <p className="mt-3 glass-card rounded-[12px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{diagnosisNotice}</p>}
              {diagnosisLoading && <div className="mt-8 glass-card rounded-[20px] p-6 text-slate-600">正在读取历史诊断记录...</div>}

              {!diagnosisLoading && diagnoses.length === 0 && (
                <div className="mt-8 glass-card rounded-[20px] p-6">
                  <h2 className="text-2xl font-bold text-slate-950">还没有诊断记录</h2>
                  <p className="mt-3 text-slate-600">上传一张正面照片后，这里会显示你的历史诊断。</p>
                </div>
              )}

              {diagnosisBatchMode && diagnoses.length > 0 && (
                <BatchToolbar
                  selectedCount={selectedDiagnoses.length}
                  exportProgress={diagnosisExportProgress}
                  isBusy={diagnosisBusy}
                  onToggleAll={toggleAllDiagnoses}
                  allSelected={allDiagnosesSelected}
                  onDelete={() => void batchDeleteDiagnoses()}
                  onExport={() => void batchExportDiagnoses()}
                  onCancel={cancelDiagnosisBatchMode}
                  deleteLabel={diagnosisBulkAction === "delete" ? "删除中..." : "批量删除"}
                  exportLabel={diagnosisBulkAction === "export" ? "导出中..." : "批量导出"}
                />
              )}

              <div className="mt-6 grid gap-4">
                {diagnoses.map((diagnosis) => {
                  const season = SEASONS[diagnosis.seasonType];
                  const isDeleting = deletingDiagnosisId === diagnosis.id;
                  const isSelected = selectedDiagnosisIds.has(diagnosis.id);

                  return (
                    <article
                      key={diagnosis.id}
                      role={diagnosisBatchMode ? undefined : "link"}
                      tabIndex={diagnosisBatchMode ? -1 : 0}
                      aria-label={diagnosisBatchMode ? undefined : `查看 ${season.name} 诊断详情`}
                      onClick={() => {
                        if (!diagnosisBatchMode) openDiagnosis(diagnosis.id);
                      }}
                      onKeyDown={(event) => {
                        if (diagnosisBatchMode) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDiagnosis(diagnosis.id);
                        }
                      }}
                      className={`glass-card rounded-[20px] p-5 shadow-sm outline-none transition ${
                        isSelected ? "border-indigo-400" : "border-slate-200"
                      } ${diagnosisBatchMode ? "" : "cursor-pointer hover:border-indigo-300 hover:shadow-md focus:ring-2 focus:ring-indigo-200"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {diagnosisBatchMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={diagnosisBusy}
                              onChange={() => toggleDiagnosisOne(diagnosis.id)}
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
                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">{Math.round(diagnosis.confidence * 100)}%</span>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {diagnosis.colorPalette.map((color) => (
                          <span key={color} className="h-8 w-8 rounded-full glass-card" style={{ backgroundColor: color }} />
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3" onClick={(event) => event.stopPropagation()}>
                        {!diagnosisBatchMode && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void removeDiagnosis(diagnosis.id);
                            }}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-2 glass-card rounded-[12px] border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
            </div>
          ) : (
            <div className="mt-6">
              {outfitError && <p className="glass-card rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{outfitError}</p>}
              {outfitNotice && <p className="mt-3 glass-card rounded-[12px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{outfitNotice}</p>}
              {outfitLoading && <div className="mt-8 glass-card rounded-[20px] p-6 text-slate-600">正在读取穿搭日记...</div>}

              {!outfitLoading && outfitRecords.length === 0 && (
                <div className="mt-8 glass-card rounded-[20px] p-6">
                  <h2 className="text-2xl font-bold text-slate-950">还没有穿搭日记</h2>
                  <p className="mt-3 text-slate-600">生成一次 OOTD 后，这里会自动保存并显示历史记录。</p>
                </div>
              )}

              {outfitBatchMode && outfitRecords.length > 0 && (
                <BatchToolbar
                  selectedCount={selectedOutfits.length}
                  exportProgress={outfitExportProgress}
                  isBusy={outfitBusy}
                  onToggleAll={toggleAllOutfits}
                  allSelected={allOutfitsSelected}
                  onDelete={() => void batchDeleteOutfits()}
                  onExport={() => void batchExportOutfits()}
                  onCancel={cancelOutfitBatchMode}
                  deleteLabel={outfitBulkAction === "delete" ? "删除中..." : "批量删除"}
                  exportLabel={outfitBulkAction === "export" ? "导出中..." : "批量导出"}
                />
              )}

              <div className="mt-6 grid gap-4">
                {outfitRecords.map((record) => {
                  const isDeleting = deletingOutfitId === record.id;
                  const isSelected = selectedOutfitIds.has(record.id);

                  return (
                    <article
                      key={record.id}
                      role={outfitBatchMode ? undefined : "button"}
                      tabIndex={outfitBatchMode ? -1 : 0}
                      aria-label={outfitBatchMode ? undefined : `查看 ${record.theme || "穿搭日记"} 结果`}
                      onClick={() => {
                        if (!outfitBatchMode) void openOutfitRecord(record.id);
                      }}
                      onKeyDown={(event) => {
                        if (outfitBatchMode) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openOutfitRecord(record.id);
                        }
                      }}
                      className={`glass-card rounded-[20px] p-5 shadow-sm outline-none transition ${
                        isSelected ? "border-indigo-400" : "border-slate-200"
                      } ${outfitBatchMode ? "" : "cursor-pointer hover:border-indigo-300 hover:shadow-md focus:ring-2 focus:ring-indigo-200"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {outfitBatchMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={outfitBusy}
                              onChange={() => toggleOutfitOne(record.id)}
                              className="mt-2 h-4 w-4 rounded border-slate-300"
                              aria-label={`选择 ${record.theme || "穿搭日记"} 记录`}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-slate-500">{new Date(record.createdAt).toLocaleString("zh-CN")}</p>
                            <h2 className="mt-1 text-2xl font-bold text-slate-950">{record.theme || "穿搭日记"}</h2>
                            <p className="mt-2 text-sm text-slate-600">
                              {record.scene === "travel" ? "旅行" : "日常"} / {record.occasion || "未知场合"} / {record.mood || "未知心情"}
                            </p>
                          </div>
                        </div>
                        {record.imageUrl ? (
                          <img src={record.imageUrl} alt="" className="h-28 w-20 rounded-2xl border border-slate-200 object-cover shadow-sm" />
                        ) : (
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">{record.source === "ai" ? "AI" : "Mock"}</span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {record.colorPalette.slice(0, 6).map((color) => (
                          <span key={color} className="h-8 w-8 rounded-full glass-card" style={{ backgroundColor: color }} />
                        ))}
                      </div>

                      <div className="mt-4 text-sm leading-7 text-slate-700">
                        <span className="font-semibold text-slate-900">推荐摘要：</span>
                        {record.scene === "travel" ? "旅行" : "日常"}场景下围绕 {record.occasion || "场合"} 与 {record.mood || "心情"} 生成的穿搭方案。
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3" onClick={(event) => event.stopPropagation()}>
                        {!outfitBatchMode && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void removeOutfitRecord(record.id);
                            }}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-2 glass-card rounded-[12px] border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                {selectedOutfits.map((record) => (
                  <ExportOutfitCard key={record.id} record={record} />
                ))}
              </div>
            </div>
          )}
        </section>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}
