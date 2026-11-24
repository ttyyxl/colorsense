import Link from "next/link";
import type { CandidateSeason, DiagnosisStatus } from "@/lib/diagnosis-types";
import { labelForReason, presentationForStatus, SEASON_LABELS } from "@/lib/diagnosis-status-ui";

interface Props {
  status: DiagnosisStatus | string | undefined;
  /** 决定性原因（进入 UNCERTAIN 的直接依据）。 */
  reasons?: string[];
  /** 普通软警告：不阻止正式诊断，但需要在结果中提示。 */
  softWarnings?: string[];
  recommendations?: string[];
  candidates?: CandidateSeason[];
}

const toneClass: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  danger: "border-rose-300 bg-rose-50 text-rose-900",
  info: "border-indigo-200 bg-indigo-50 text-indigo-900",
};

/** 诊断状态提示（服务端状态的展示层，不做任何诊断决策）。 */
export function DiagnosisStatusNotice({ status, reasons = [], softWarnings = [], recommendations = [], candidates = [] }: Props) {
  const presentation = presentationForStatus(status);
  // 正式结果（CONFIDENT）默认不展示提示块；但允许携带普通质量/环境风险提示。
  if (presentation.tone === "success" && softWarnings.length === 0) return null;
  const tone = presentation.tone === "success" ? "info" : presentation.tone;

  return (
    <section className={`rounded-[20px] border p-5 sm:p-6 ${toneClass[tone]}`}>
      <h2 className="text-xl font-bold">
        {presentation.tone === "success" ? "诊断完成，存在需要注意的提示" : presentation.title}
      </h2>
      <p className="mt-2 leading-7">{presentation.description}</p>

      {reasons.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold">原因：</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-7">
            {reasons.map((reason) => <li key={reason}>{labelForReason(reason)}</li>)}
          </ul>
        </div>
      )}

      {softWarnings.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold">提示（不影响本次正式结果）：</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-7">
            {softWarnings.map((reason) => <li key={reason}>{labelForReason(reason)}</li>)}
          </ul>
        </div>
      )}

      {presentation.showCandidates && candidates.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold">候选季型（非确定性结论）：</p>
          <ul className="mt-2 space-y-1">
            {candidates.map((candidate, index) => (
              <li key={candidate.season}>
                {index + 1}. {SEASON_LABELS[candidate.season] ?? candidate.season}：{Math.round(candidate.score * 100)}%
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold">改善建议：</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-7">
            {recommendations.map((text, index) => <li key={`${index}-${text}`}>{text}</li>)}
          </ul>
        </div>
      )}

      {presentation.showRetake && (
        <Link
          href="/upload"
          className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
        >
          重新上传照片
        </Link>
      )}
    </section>
  );
}
