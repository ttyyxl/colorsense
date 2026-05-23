import type { SeasonProfile } from "@/lib/seasons";

interface SeasonCardProps {
  season: SeasonProfile;
  confidence: number;
  compact?: boolean;
}

export function SeasonCard({ season, confidence, compact = false }: SeasonCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5" style={{ background: `linear-gradient(135deg, ${season.accent}33, #ffffff)` }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">{season.nameEn}</p>
            <h3 className={compact ? "text-2xl font-bold text-slate-950" : "text-4xl font-bold text-slate-950"}>
              {season.emoji} {season.name}
            </h3>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-slate-700">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <p className="mt-4 leading-7 text-slate-700">{season.description}</p>
        {!compact && <p className="mt-4 leading-7 text-slate-600">{season.styleDesc}</p>}
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full" style={{ width: `${confidence * 100}%`, backgroundColor: season.accent }} />
        </div>
      </div>
    </article>
  );
}
