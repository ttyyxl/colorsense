import { GeminiStyleAdvice } from "@/lib/types";
import { Sparkles, Shirt, Palette, Scissors, Gem, Ban, Heart } from "lucide-react";

interface GeminiAdviceSectionProps {
  advice: GeminiStyleAdvice;
}

export function GeminiAdviceSection({ advice }: GeminiAdviceSectionProps) {
  return (
    <section className="space-y-8 rounded-3xl border border-rose-100 bg-rose-50/20 p-8 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-rose-600">
          <div className="rounded-full bg-rose-100 p-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{advice.title}</h2>
        </div>
        <div className="hidden sm:block">
          <span className="rounded-full bg-rose-100 px-4 py-1 text-xs font-semibold text-rose-600 uppercase tracking-widest">
            Gemini AI Consultant
          </span>
        </div>
      </div>

      <div className="relative">
        <Heart className="absolute -left-2 -top-2 h-8 w-8 text-rose-100 opacity-50" />
        <p className="relative text-lg text-slate-700 leading-relaxed font-medium pl-6">
          {advice.summary}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {advice.style_keywords.map((tag) => (
          <span key={tag} className="rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-rose-500 shadow-sm border border-rose-50">
            # {tag}
          </span>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* 服装建议 */}
        <div className="group rounded-2xl bg-white p-6 transition-all hover:shadow-md border border-slate-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-500">
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

        {/* 妆容建议 */}
        <div className="group rounded-2xl bg-white p-6 transition-all hover:shadow-md border border-slate-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-purple-50 p-2 text-purple-500">
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

        {/* 发型建议 */}
        <div className="group rounded-2xl bg-white p-6 transition-all hover:shadow-md border border-slate-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-500">
              <Scissors className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900">发型建议</h3>
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

        {/* 配饰建议 */}
        <div className="group rounded-2xl bg-white p-6 transition-all hover:shadow-md border border-slate-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-500">
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

      {/* 避雷指南 */}
      <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
        <div className="mb-4 flex items-center gap-3 text-rose-400">
          <Ban className="h-5 w-5" />
          <h3 className="font-bold">避雷指南 SOS</h3>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {advice.avoid_recommendations.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
