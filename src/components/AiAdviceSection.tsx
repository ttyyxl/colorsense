import { AiAdvice } from "@/lib/types";
import { Sparkles, Shirt, Palette, AlertCircle } from "lucide-react";

interface AiAdviceSectionProps {
  advice: AiAdvice;
}

export function AiAdviceSection({ advice }: AiAdviceSectionProps) {
  return (
    <section className="space-y-6 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6">
      <div className="flex items-center gap-2 text-indigo-700">
        <Sparkles className="h-5 w-5" />
        <h2 className="text-lg font-bold">AI 专属穿搭建议</h2>
      </div>

      <p className="text-slate-700 leading-relaxed italic border-l-4 border-indigo-200 pl-4">
        "{advice.summary}"
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Shirt className="h-4 w-4 text-indigo-500" />
            <h3>穿搭方案</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {advice.clothing.advice}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {advice.clothing.colors.map((color) => (
              <span 
                key={color} 
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm border border-indigo-50"
              >
                {color}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Palette className="h-4 w-4 text-purple-500" />
            <h3>妆容配饰</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {advice.makeup.advice}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-900">避雷建议</h4>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            {advice.avoid}
          </p>
        </div>
      </div>
    </section>
  );
}
