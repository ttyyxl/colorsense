"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check } from "lucide-react";
import type { PaletteGroup } from "./home-data";

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const;

export function PaletteExplorer({ groups }: { groups: PaletteGroup[] }) {
  const [activeId, setActiveId] = useState(groups[0]?.id ?? "");
  const [copiedColor, setCopiedColor] = useState("");
  const activeGroup = groups.find((group) => group.id === activeId) ?? groups[0];

  async function copyColor(color: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(color);
      setCopiedColor(color);
      window.setTimeout(() => setCopiedColor(""), 1400);
    }
  }

  return (
    <section className="glass-card gpu-safe relative overflow-hidden rounded-[20px] p-6 sm:p-7 lg:p-8">
      <div className="absolute right-10 top-8 h-36 w-36 rounded-full bg-[#81bfe9]/14 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#578af4]">场景色卡</p>
          <h2 className="mt-2 text-3xl font-bold text-[#181698]">把色彩档案带进真实场景</h2>
          <p className="mt-3 max-w-2xl font-light leading-7 text-[#667694]">从日常到聚会，用更贴近生活的配色建议，把个人色彩转化为具体穿搭灵感。</p>
        </div>
        <div className="flex gap-2 overflow-x-auto rounded-xl bg-white/42 p-1 ring-1 ring-[#81bfe9]/20" role="tablist" aria-label="配色场景">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeId === group.id}
              aria-controls={`palette-panel-${group.id}`}
              aria-label={`${group.label}，${group.title}`}
              id={`palette-tab-${group.id}`}
              onClick={() => setActiveId(group.id)}
              className={`relative min-w-20 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeId === group.id ? "text-[#181698]" : "text-[#667694] hover:text-[#181698]"}`}
            >
              {activeId === group.id && <motion.span layoutId="palette-active-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={springTransition} />}
              <span className="relative">{group.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeGroup.id}
          id={`palette-panel-${activeGroup.id}`}
          role="tabpanel"
          aria-labelledby={`palette-tab-${activeGroup.id}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={springTransition}
          className="relative mt-8 grid gap-7 md:grid-cols-[0.88fr_1.12fr] md:items-center"
        >
          <div>
            <motion.h3 layoutId="scene-title" className="text-2xl font-bold text-[#181698]">
              {activeGroup.title}
            </motion.h3>
            <motion.p layoutId="scene-description" className="mt-3 font-light leading-7 text-[#667694]">
              {activeGroup.description}
            </motion.p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href={activeGroup.href} className="inline-flex h-12 items-center gap-2 rounded-xl bg-white/58 px-5 text-sm font-semibold text-[#181698] ring-1 ring-[#81bfe9]/28 transition hover:-translate-y-0.5 hover:bg-white">
                {activeGroup.cta}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <AnimatePresence>
                {copiedColor && (
                  <motion.span
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={springTransition}
                    className="rounded-xl bg-[#eef6ff]/80 px-3 py-2 text-xs font-semibold text-[#181698] ring-1 ring-[#81bfe9]/22"
                  >
                    已复制 {copiedColor}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-4 overflow-hidden rounded-[20px] ring-1 ring-white/70">
            {activeGroup.colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => void copyColor(color)}
                className="group relative h-28 overflow-hidden text-xs font-semibold text-white outline-none transition hover:z-10 hover:scale-[1.03] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#181698] sm:h-36"
                style={{ backgroundColor: color }}
                aria-label={`复制颜色 ${color}`}
              >
                <span className="absolute inset-x-2 bottom-2 translate-y-2 rounded-[10px] bg-[#181698]/82 px-2 py-1 opacity-0 shadow-sm backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  {copiedColor === color ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      已复制
                    </span>
                  ) : (
                    color
                  )}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
