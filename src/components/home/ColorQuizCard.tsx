"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { QuizPreviewStep } from "./home-data";

const springTransition = { type: "spring", stiffness: 150, damping: 22 } as const;

export function ColorQuizCard({ steps }: { steps: QuizPreviewStep[] }) {
  const [activeId, setActiveId] = useState(steps[0]?.id ?? "");
  const activeStep = steps.find((step) => step.id === activeId) ?? steps[0];

  return (
    <article className="glass-card gpu-safe rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#7f8f86]">色彩诊断</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#2f3432]">三步建立你的色彩档案</h2>
        </div>
        <Link href="/upload" className="rounded-full bg-white/70 p-2 text-[#4e5d58] ring-1 ring-white/70 hover:bg-white" aria-label="开始诊断">
          <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-5 flex rounded-2xl bg-white/45 p-1" role="tablist" aria-label="色彩诊断步骤">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={activeId === step.id}
            aria-controls={`quiz-panel-${step.id}`}
            aria-label={`${step.label} ${step.title}`}
            id={`quiz-tab-${step.id}`}
            onClick={() => setActiveId(step.id)}
            className="relative min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-[#5f6662]"
          >
            {activeId === step.id && <motion.span layoutId="quiz-active-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={springTransition} />}
            <span className="relative">{step.label}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={activeStep.id}
        id={`quiz-panel-${activeStep.id}`}
        role="tabpanel"
        aria-labelledby={`quiz-tab-${activeStep.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="mt-5 rounded-3xl bg-white/56 p-5"
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-[#7f8f86]" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-[#2f3432]">{activeStep.title}</h3>
        </div>
        <p className="mt-3 leading-7 text-[#666d69]">{activeStep.detail}</p>
      </motion.div>
    </article>
  );
}
