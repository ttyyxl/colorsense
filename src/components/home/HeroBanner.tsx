"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import type { HomeRouteAction } from "./home-data";

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const;

const profileSlides = [
  {
    id: "spring",
    emoji: "🌷",
    title: "Spring Light",
    label: "春型倾向",
    trait: "明亮、轻盈、带一点暖意",
    status: "清透分析",
    colors: ["#fff7df", "#ffd66b", "#ff9f80", "#95d9b8", "#6fb7ff"],
  },
  {
    id: "summer",
    emoji: "🫧",
    title: "Summer Mist",
    label: "夏型倾向",
    trait: "柔雾、冷调、低对比",
    status: "冷调校准",
    colors: ["#f7fbff", "#d9e7f7", "#b7c9e8", "#c9b7dd", "#8fb6d9"],
  },
  {
    id: "autumn",
    emoji: "🍂",
    title: "Autumn Glow",
    label: "秋型倾向",
    trait: "温润、浓郁、自然质感",
    status: "暖度识别",
    colors: ["#fff0d6", "#d8a35d", "#a96f43", "#8f9b6b", "#5f6f52"],
  },
  {
    id: "winter",
    emoji: "❄️",
    title: "Winter Clear",
    label: "冬型倾向",
    trait: "清冷、高对比、利落",
    status: "对比增强",
    colors: ["#ffffff", "#bcc6d7", "#578af4", "#181698", "#27314f"],
  },
];

export function HeroBanner({ primaryActions }: { primaryActions: HomeRouteAction[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeProfile = profileSlides[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % profileSlides.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

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

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {primaryActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div key={action.href} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: index * 0.06 }}>
                  <Link
                    href={action.href}
                    className={`group inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition hover:-translate-y-0.5 ${action.tone}`}
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
            style={{ backgroundColor: activeProfile.colors[2], opacity: 0.34 }}
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
                {activeProfile.status}
              </motion.span>
            </div>

            <motion.div layout className="mt-7 grid grid-cols-5 overflow-hidden rounded-[20px] ring-1 ring-white/60">
              {activeProfile.colors.map((color) => (
                <motion.div
                  layoutId={`hero-color-${color}`}
                  key={color}
                  className="h-24"
                  style={{ backgroundColor: color }}
                  title={color}
                  transition={springTransition}
                />
              ))}
            </motion.div>

            <motion.div layout className="mt-6 rounded-[20px] bg-white/46 p-5 ring-1 ring-[#81bfe9]/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#667694]">动态色彩档案</p>
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
                <div className="flex -space-x-2">
                  {activeProfile.colors.slice(1, 4).map((color) => (
                    <motion.span
                      layoutId={`hero-dot-${color}`}
                      key={color}
                      className="h-10 w-10 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: color }}
                      transition={springTransition}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="mt-6 space-y-3">
              {["上传照片", "识别色彩倾向", "生成搭配灵感"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-white/40 px-4 py-3 text-sm font-medium text-[#667694] ring-1 ring-[#81bfe9]/18">
                  <CheckCircle2 className={`h-4 w-4 ${index === 2 ? "text-[#81bfe9]" : "text-[#578af4]"}`} aria-hidden="true" />
                  <span className="flex-1">{item}</span>
                  <span className="text-xs font-semibold text-[#181698]">{index < 2 ? "演示中" : "准备中"}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
