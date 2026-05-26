import { DoubaoStyleAdvice } from "@/lib/ai";
import { Sparkles, Shirt, Palette, Scissors, Gem, Ban, Coffee } from "lucide-react";

interface DoubaoAdviceSectionProps {
  advice: DoubaoStyleAdvice;
}

export function DoubaoAdviceSection({ advice }: DoubaoAdviceSectionProps) {
  return (
    <section className="space-y-8 rounded-3xl border border-indigo-100 bg-white p-8 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-50 pb-6">
        <div className="flex items-center gap-3 text-indigo-600">
          <div className="rounded-full bg-indigo-50 p-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{advice.title}</h2>
        </div>
        <div className="hidden sm:block">
          <span className="rounded-full bg-slate-100 px-4 py-1 text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Coffee className="h-3 w-3" />
            Doubao Personal Consultant
          </span>
        </div>
      </div>

      <div className="relative">
        <p className="relative text-lg text-slate-700 leading-relaxed font-medium pl-4 border-l-4 border-indigo-200">
          {advice.summary}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {advice.style_keywords.map((tag) => (
          <span key={tag} className="rounded-lg bg-indigo-50/50 px-4 py-1.5 text-sm font-bold text-indigo-600 border border-indigo-50">
            # {tag}
          </span>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* 穿搭 OOTD */}
        <div className="group rounded-2xl bg-slate-50/50 p-6 transition-all border border-transparent hover:border-indigo-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-blue-100/50 p-2 text-blue-600">
              <Shirt className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900">穿搭 OOTD</h3>
          </div>
          <ul className="space-y-3">
            {advice.fashion_recommendations.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 精致妆容 */}
        <div className="group rounded-2xl bg-slate-50/50 p-6 transition-all border border-transparent hover:border-purple-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-purple-100/50 p-2 text-purple-600">
              <Palette className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900">精致妆容</h3>
          </div>
          <ul className="space-y-3">
            {advice.makeup_recommendations.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 发型氛围 */}
        <div className="group rounded-2xl bg-slate-50/50 p-6 transition-all border border-transparent hover:border-emerald-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100/50 p-2 text-emerald-600">
              <Scissors className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900">发型氛围</h3>
          </div>
          <ul className="space-y-3">
            {advice.hair_recommendations.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 饰品点缀 */}
        <div className="group rounded-2xl bg-slate-50/50 p-6 transition-all border border-transparent hover:border-amber-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-amber-100/50 p-2 text-amber-600">
              <Gem className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900">饰品点缀</h3>
          </div>
          <ul className="space-y-3">
            {advice.accessory_recommendations.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 避雷指南 SOS */}
      <div className="rounded-2xl bg-rose-50 p-6 border border-rose-100">
        <div className="mb-4 flex items-center gap-3 text-rose-600">
          <Ban className="h-5 w-5" />
          <h3 className="font-bold">避雷指南 SOS</h3>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {advice.avoid_recommendations.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-rose-800 leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
