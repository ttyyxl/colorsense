"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { HomeRouteAction } from "./home-data";

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const;

const profileSlides = [
  {
    id: "spring",
    emoji: "🌷",
    title: "Spring Light",
    label: "春型倾向",
    trait: "明亮、暖亮、清透",
    attribute: "明亮 / 生机",
    accent: "#FFB08A",
    colors: ["#FFB08A", "#9DCE6D", "#F5D35C", "#FFF1DC"],
    keywords: ["清透", "轻盈", "暖亮"],
  },
  {
    id: "summer",
    emoji: "🫧",
    title: "Summer Mist",
    label: "夏型倾向",
    trait: "柔雾、冷调、低对比",
    attribute: "柔雾 / 清雅",
    accent: "#A9C7E8",
    colors: ["#A9C7E8", "#C9B4DF", "#DDBFD1", "#F4F8FE"],
    keywords: ["柔雾", "冷调", "优雅"],
  },
  {
    id: "autumn",
    emoji: "🍂",
    title: "Autumn Glow",
    label: "秋型倾向",
    trait: "温润、浓郁、自然",
    attribute: "温润 / 沉稳",
    accent: "#C96B3E",
    colors: ["#9A6138", "#C96B3E", "#C8A338", "#F2E4D0"],
    keywords: ["温润", "浓郁", "自然"],
  },
  {
    id: "winter",
    emoji: "❄️",
    title: "Winter Clear",
    label: "冬型倾向",
    trait: "清冷、高对比、利落",
    attribute: "冷冽 / 纯粹",
    accent: "#1B2D8F",
    colors: ["#1B2D8F", "#E91B4C", "#F4F8FF", "#0F1738"],
    keywords: ["清冷", "高对比", "利落"],
  },
];

export function HeroBanner({ primaryActions }: { primaryActions: HomeRouteAction[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedColor, setCopiedColor] = useState("");
  const activeProfile = profileSlides[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % profileSlides.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, []);

  async function copyColor(color: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(color);
      setCopiedColor(color);
      window.setTimeout(() => setCopiedColor(""), 1200);
    }
  }

  return (
    <section className="glass-card-strong home-dashboard-watercolor gpu-safe overflow-hidden rounded-[20px] p-6 sm:p-7 lg:p-8">
      <div className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-xl bg-white/64 px-3 py-1.5 text-sm font-semibold text-[#181698] ring-1 ring-[#81bfe9]/30">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI 四季色彩诊断
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-[#181698] sm:text-5xl lg:text-6xl">
            上传照片，发现属于你的色彩
          </h1>
          <p className="mt-5 max-w-xl text-base font-light leading-8 text-[#667694] sm:text-lg">
            基于前沿美学洞察，为你定制专属的个人色彩档案与搭配灵感。
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {primaryActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div key={action.href} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: index * 0.06 }}>
                  <Link
                    href={action.href}
                    className={`group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:-translate-y-0.5 ${action.tone}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {action.title}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          layout
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: 0.08 }}
          className="glass-card gpu-safe relative overflow-hidden rounded-[20px] p-6 will-change-transform sm:p-7"
        >
          <motion.div
            layoutId="profile-glow"
            className="absolute right-5 top-5 h-28 w-28 rounded-full blur-3xl"
            style={{ backgroundColor: activeProfile.accent, opacity: 0.28 }}
            transition={springTransition}
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={activeProfile.id + "-label"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={springTransition}
                    className="text-sm font-semibold text-[#578af4]"
                  >
                    {activeProfile.label}
                  </motion.p>
                </AnimatePresence>
                <div className="mt-2 flex items-center gap-3">
                  <motion.span layoutId="profile-emoji" className="text-3xl" transition={springTransition}>
                    {activeProfile.emoji}
                  </motion.span>
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={activeProfile.id + "-title"}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={springTransition}
                      className="text-2xl font-bold text-[#181698]"
                    >
                      {activeProfile.title}
                    </motion.h2>
                  </AnimatePresence>
                </div>
              </div>
              <motion.span layout className="rounded-xl bg-white/54 px-3 py-1 text-xs font-semibold text-[#181698] ring-1 ring-[#81bfe9]/24">
                实时预览
              </motion.span>
            </div>

            <motion.div layout className="mt-7 grid grid-cols-4 overflow-hidden rounded-[20px] ring-1 ring-white/60">
              {activeProfile.colors.map((color) => (
                <motion.button
                  layoutId={`hero-color-${color}`}
                  key={color}
                  type="button"
                  onClick={() => void copyColor(color)}
                  className="group relative h-24 overflow-hidden text-xs font-semibold text-white outline-none transition hover:z-10 hover:scale-[1.03] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#181698]"
                  style={{ backgroundColor: color }}
                  aria-label={`复制颜色 ${color}`}
                  transition={springTransition}
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
                </motion.button>
              ))}
            </motion.div>

            <motion.div layout className="mt-6 rounded-[20px] bg-white/46 p-5 ring-1 ring-[#81bfe9]/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#667694]">动态 Profile 沙盒</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={activeProfile.id + "-trait"}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={springTransition}
                      className="mt-1 text-xl font-bold text-[#181698]"
                    >
                      {activeProfile.trait}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <motion.span layout className="rounded-xl bg-white/50 px-3 py-1.5 text-xs font-semibold text-[#181698] ring-1 ring-[#81bfe9]/20">
                  {activeProfile.attribute}
                </motion.span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {activeProfile.keywords.map((keyword) => (
                  <span key={keyword} className="rounded-xl bg-[#eef6ff]/70 px-3 py-1.5 text-xs font-semibold text-[#181698] ring-1 ring-[#81bfe9]/18">
                    {keyword}
                  </span>
                ))}
              </div>
            </motion.div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {["照片色彩提取", "四季倾向映射", "搭配灵感生成"].map((item) => (
                <div key={item} className="rounded-xl bg-white/40 px-4 py-3 text-sm font-medium text-[#667694] ring-1 ring-[#81bfe9]/18">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
