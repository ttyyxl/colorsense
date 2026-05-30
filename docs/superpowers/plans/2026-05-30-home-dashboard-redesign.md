# Home Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the ColorSense home page as an app-like dashboard entry point with approachable luxury styling while preserving all existing product routes.

**Architecture:** Keep `src/app/page.tsx` as a small server component that passes `SEASONS` into a client-side `HomeDashboard`. Split the dashboard into focused `components/home/*` modules for hero, route actions, preview cards, palette exploration, season stack, and mobile action bar. Use CSS variables in `globals.css` for the Morandi monochrome watercolor system and Framer Motion for spring-based card interactions.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS v4, Framer Motion, lucide-react.

---

## File Structure

- Modify: `src/app/globals.css`
  - Add Morandi monochrome CSS variables.
  - Add reusable glass/watercolor utility classes.
  - Add hardware-acceleration safeguards for glass cards.
- Modify: `src/app/page.tsx`
  - Replace inline homepage markup with a `HomeDashboard` composition.
  - Keep static `SEASONS` data source.
- Create: `src/components/home/home-data.ts`
  - Centralize route links, quiz preview steps, dashboard actions, and palette copy.
- Create: `src/components/home/HomeDashboard.tsx`
  - Client component that composes the redesigned home dashboard.
- Create: `src/components/home/HeroBanner.tsx`
  - App-like welcome panel with CTA links.
- Create: `src/components/home/ColorQuizCard.tsx`
  - Lightweight test preview with local step switching.
- Create: `src/components/home/StyleDashboard.tsx`
  - Compact style and outfit recommendation preview.
- Create: `src/components/home/PaletteExplorer.tsx`
  - Local palette switching and clipboard copy feedback.
- Create: `src/components/home/DashboardQuickActions.tsx`
  - Route action cards for existing pages.
- Create: `src/components/home/SeasonPreviewStack.tsx`
  - Layered season cards using existing `SEASONS`.
- Create: `src/components/home/MobileActionBar.tsx`
  - Mobile-only fixed route action bar.

## Task 1: Theme Variables And Utility Classes

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the current global theme with Morandi dashboard variables**

Update `src/app/globals.css` to include these variables and utility classes:

```css
@import "tailwindcss";

:root {
  --background: #f8f6fb;
  --foreground: #242238;
  --brand-ink: #302f4d;
  --brand-deep: #4d4a73;
  --brand: #6f6a9f;
  --brand-muted: #9a96bd;
  --brand-mist: #d9d7e8;
  --brand-wash: #f3f1f8;
  --brand-blush: #eee6ef;
  --brand-lilac: #cbc6df;
  --surface-glass: rgba(255, 255, 255, 0.68);
  --surface-strong: rgba(255, 255, 255, 0.86);
  --shadow-soft: 0 24px 80px rgba(77, 74, 115, 0.16);
  --shadow-card: 0 18px 50px rgba(77, 74, 115, 0.13);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

a {
  text-decoration: none;
}

.watercolor-wash {
  background-image:
    radial-gradient(circle at 12% 18%, rgba(203, 198, 223, 0.58), transparent 34%),
    radial-gradient(circle at 82% 12%, rgba(238, 230, 239, 0.72), transparent 32%),
    radial-gradient(circle at 72% 78%, rgba(217, 215, 232, 0.62), transparent 36%),
    linear-gradient(135deg, #fbf9fc 0%, #f3f1f8 48%, #faf8fb 100%);
}

.glass-card {
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: var(--surface-glass);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(22px);
  transform: translateZ(0);
  will-change: transform;
}

.glass-card-strong {
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: var(--surface-strong);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(26px);
  transform: translateZ(0);
  will-change: transform;
}
```

- [ ] **Step 2: Run a syntax check through build later**

Do not run a separate CSS command. This project validates CSS through `npm run build` in Task 10.

## Task 2: Shared Home Data

**Files:**
- Create: `src/components/home/home-data.ts`

- [ ] **Step 1: Create static route and preview data**

Create `src/components/home/home-data.ts`:

```ts
import { Camera, Clock3, FileUser, History, Palette, Sparkles } from "lucide-react";

export const dashboardActions = [
  {
    title: "开始色彩诊断",
    description: "上传照片，生成你的四季型色彩报告。",
    href: "/upload",
    icon: Camera,
  },
  {
    title: "今日穿搭灵感",
    description: "结合场景、天气与个人档案生成搭配建议。",
    href: "/outfit",
    icon: Sparkles,
  },
  {
    title: "查看历史记录",
    description: "回顾过往诊断结果和保存的色彩卡。",
    href: "/history",
    icon: History,
  },
  {
    title: "个人风格档案",
    description: "维护偏好、场景和风格关键词。",
    href: "/profile/style",
    icon: FileUser,
  },
];

export const quizPreviewSteps = [
  {
    label: "上传",
    title: "选择自然光照片",
    description: "清晰的面部照片会让肤色提取更稳定。",
  },
  {
    label: "分析",
    title: "读取肤色与明度",
    description: "系统会在 LAB 色彩空间里判断冷暖与对比。",
  },
  {
    label: "报告",
    title: "生成个人色彩建议",
    description: "输出季型、色卡、规避色和穿搭方向。",
  },
];

export const paletteGroups = [
  {
    name: "晨雾丁香",
    mood: "柔和、清透、适合通勤和初次约会",
    colors: ["#f6f2f7", "#ded8ea", "#b8b1cf", "#7e789f", "#4d4a73"],
  },
  {
    name: "玫瑰灰紫",
    mood: "温暖、细腻、适合轻正式场合",
    colors: ["#fbf4f6", "#eadde5", "#c8afc4", "#92799a", "#5a4867"],
  },
  {
    name: "静水蓝紫",
    mood: "安静、理性、适合面试和作品集展示",
    colors: ["#f4f6fa", "#dce1ef", "#b8c0d9", "#7b86aa", "#414b70"],
  },
];

export const mobileActions = [
  { label: "诊断", href: "/upload", icon: Camera },
  { label: "搭配", href: "/outfit", icon: Palette },
  { label: "历史", href: "/history", icon: Clock3 },
];
```

- [ ] **Step 2: Confirm TypeScript imports resolve later**

Lucide icon components are already used elsewhere in the project. Validate through `npm run build` in Task 10.

## Task 3: Hero Banner

**Files:**
- Create: `src/components/home/HeroBanner.tsx`

- [ ] **Step 1: Create the hero component**

Create `src/components/home/HeroBanner.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, History, Sparkles } from "lucide-react";

const spring = { type: "spring", stiffness: 150, damping: 22 };

export function HeroBanner() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="glass-card-strong relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 lg:px-10 lg:py-12"
    >
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[rgba(203,198,223,0.45)] blur-3xl" />
      <div className="absolute -bottom-24 left-20 h-64 w-64 rounded-full bg-[rgba(238,230,239,0.68)] blur-3xl" />
      <div className="relative max-w-3xl">
        <p className="inline-flex rounded-full border border-white/70 bg-white/55 px-4 py-2 text-sm font-semibold text-[var(--brand-deep)] shadow-sm">
          AI 色彩诊断 · 个人风格搭配 · App 化体验入口
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight text-[var(--brand-ink)] sm:text-5xl lg:text-6xl">
          用一张照片，建立你的专属色彩与风格仪式。
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[rgba(48,47,77,0.72)] sm:text-lg">
          ColorSense 将四季型色彩诊断、个人风格档案和今日穿搭建议整理成清晰入口。首页只做轻量预览，完整流程仍在原有页面中完成。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-deep)] px-6 py-3 font-semibold text-white shadow-lg shadow-[rgba(77,74,115,0.24)] transition hover:bg-[var(--brand-ink)]"
          >
            开始诊断
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/outfit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-6 py-3 font-semibold text-[var(--brand-deep)] transition hover:bg-white"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            今日 OOTD
          </Link>
          <Link
            href="/history"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/40 px-6 py-3 font-semibold text-[var(--brand-deep)] transition hover:bg-white"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            查看历史
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Keep route behavior unchanged**

Verify the three links target `/upload`, `/outfit`, and `/history`.

## Task 4: Color Quiz Preview Card

**Files:**
- Create: `src/components/home/ColorQuizCard.tsx`

- [ ] **Step 1: Create the local-step preview component**

Create `src/components/home/ColorQuizCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { quizPreviewSteps } from "./home-data";

const spring = { type: "spring", stiffness: 150, damping: 22 };

export function ColorQuizCard() {
  const [activeStep, setActiveStep] = useState(0);
  const step = quizPreviewSteps[activeStep];

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={spring}
      className="glass-card rounded-[1.75rem] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--brand-muted)]">轻量测试预览</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">色彩诊断流程</h2>
        </div>
        <Link
          href="/upload"
          className="rounded-full bg-white/70 p-2 text-[var(--brand-deep)] transition hover:bg-white"
          aria-label="前往上传诊断"
        >
          <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {quizPreviewSteps.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveStep(index)}
            className="relative rounded-2xl px-3 py-3 text-left text-sm font-semibold text-[var(--brand-deep)]"
          >
            {activeStep === index && (
              <motion.span
                layoutId="quiz-active-pill"
                transition={spring}
                className="absolute inset-0 rounded-2xl bg-white/80 shadow-sm"
              />
            )}
            <span className="relative">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-36 rounded-3xl border border-white/70 bg-white/45 p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={spring}
          >
            <p className="text-sm font-semibold text-[var(--brand-muted)]">Step {activeStep + 1}</p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--brand-ink)]">{step.title}</h3>
            <p className="mt-3 leading-7 text-[rgba(48,47,77,0.68)]">{step.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
```

- [ ] **Step 2: Add the missing React import**

At the top of the same file, add:

```tsx
import { useState } from "react";
```

- [ ] **Step 3: Confirm no real upload logic is introduced**

The only business action in this component must be the `/upload` link.

## Task 5: Style Dashboard And Quick Actions

**Files:**
- Create: `src/components/home/StyleDashboard.tsx`
- Create: `src/components/home/DashboardQuickActions.tsx`

- [ ] **Step 1: Create `StyleDashboard`**

Create `src/components/home/StyleDashboard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

const spring = { type: "spring", stiffness: 150, damping: 22 };

export function StyleDashboard() {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={spring}
      className="glass-card rounded-[1.75rem] p-5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-white/75 p-3 text-[var(--brand-deep)]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--brand-muted)]">风格推荐预览</p>
          <h2 className="text-2xl font-semibold text-[var(--brand-ink)]">今日柔雾通勤</h2>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {["低饱和紫灰针织", "珍珠白内搭", "雾面银色配饰"].map((item) => (
          <div key={item} className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-sm font-semibold text-[var(--brand-deep)]">
            {item}
          </div>
        ))}
      </div>
      <p className="mt-5 leading-7 text-[rgba(48,47,77,0.68)]">
        保留轻量建议预览，完整的场景、天气与心情搭配仍在今日 OOTD 页面完成。
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/outfit" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-deep)] px-5 py-3 font-semibold text-white">
          生成穿搭
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link href="/profile/style" className="inline-flex items-center justify-center rounded-2xl border border-white/70 bg-white/55 px-5 py-3 font-semibold text-[var(--brand-deep)]">
          风格档案
        </Link>
      </div>
    </motion.article>
  );
}
```

- [ ] **Step 2: Create `DashboardQuickActions`**

Create `src/components/home/DashboardQuickActions.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { dashboardActions } from "./home-data";

const spring = { type: "spring", stiffness: 150, damping: 22 };

export function DashboardQuickActions() {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {dashboardActions.map((action, index) => {
        const Icon = action.icon;
        return (
          <motion.div
            key={action.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: index * 0.04 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
          >
            <Link href={action.href} className="glass-card flex h-full gap-4 rounded-[1.5rem] p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-[var(--brand-deep)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold text-[var(--brand-ink)]">{action.title}</span>
                <span className="mt-1 block text-sm leading-6 text-[rgba(48,47,77,0.66)]">{action.description}</span>
              </span>
            </Link>
          </motion.div>
        );
      })}
    </section>
  );
}
```

## Task 6: Palette Explorer

**Files:**
- Create: `src/components/home/PaletteExplorer.tsx`

- [ ] **Step 1: Create the palette explorer component**

Create `src/components/home/PaletteExplorer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy } from "lucide-react";
import { paletteGroups } from "./home-data";

const spring = { type: "spring", stiffness: 150, damping: 22 };

export function PaletteExplorer() {
  const [activePalette, setActivePalette] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const palette = paletteGroups[activePalette];

  async function copyColor(color: string) {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(color);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={spring}
      className="glass-card rounded-[1.75rem] p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-[var(--brand-muted)]">配色探索沙盒</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">莫兰迪水彩色阶</h2>
      <div className="mt-5 flex flex-wrap gap-2">
        {paletteGroups.map((item, index) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setActivePalette(index)}
            className="relative rounded-full px-4 py-2 text-sm font-semibold text-[var(--brand-deep)]"
          >
            {activePalette === index && (
              <motion.span layoutId="palette-active-pill" transition={spring} className="absolute inset-0 rounded-full bg-white/80 shadow-sm" />
            )}
            <span className="relative">{item.name}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={palette.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={spring}
          className="mt-5"
        >
          <p className="leading-7 text-[rgba(48,47,77,0.68)]">{palette.mood}</p>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {palette.colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => copyColor(color)}
                className="group flex min-h-28 flex-col justify-end overflow-hidden rounded-2xl border border-white/70 text-left shadow-sm"
                style={{ backgroundColor: color }}
                title={`复制 ${color}`}
              >
                <span className="flex items-center gap-1 bg-white/72 px-2 py-2 text-[11px] font-semibold text-[var(--brand-ink)] opacity-0 transition group-hover:opacity-100">
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  {copied === color ? "已复制" : color}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.article>
  );
}
```

- [ ] **Step 2: Confirm local-only behavior**

No API calls and no route changes should exist in this file.

## Task 7: Season Preview Stack

**Files:**
- Create: `src/components/home/SeasonPreviewStack.tsx`

- [ ] **Step 1: Create the layered season preview**

Create `src/components/home/SeasonPreviewStack.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { SeasonProfile } from "@/lib/seasons";

const spring = { type: "spring", stiffness: 150, damping: 22 };

interface SeasonPreviewStackProps {
  seasons: SeasonProfile[];
}

export function SeasonPreviewStack({ seasons }: SeasonPreviewStackProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="glass-card rounded-[1.75rem] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--brand-muted)]">四季型预览</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">层叠色彩档案</h2>
        </div>
        <Link href="/upload" className="text-sm font-semibold text-[var(--brand-deep)] hover:text-[var(--brand-ink)]">
          生成我的结果
        </Link>
      </div>
      <div className="relative mt-7 min-h-72">
        {seasons.map((season, index) => (
          <motion.div
            key={season.nameEn}
            initial={{ opacity: 0, x: 24, rotate: 0 }}
            animate={{ opacity: 1, x: index * 14, y: index * 18, rotate: index * -2 }}
            whileHover={{ y: index * 18 - 8, rotate: index * -1 }}
            transition={{ ...spring, delay: index * 0.05 }}
            className="absolute left-0 top-0 w-[86%] rounded-[1.5rem] border border-white/70 bg-white/70 p-4 shadow-lg backdrop-blur-xl"
            style={{ zIndex: seasons.length - index }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted)]">{season.nameEn}</p>
                <h3 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{season.name}</h3>
              </div>
              <span className="h-10 w-10 rounded-full border border-white shadow-sm" style={{ backgroundColor: season.accent }} />
            </div>
            <div className="mt-4 flex gap-2">
              {season.palette.slice(0, 5).map((color) => (
                <span key={color} className="h-9 flex-1 rounded-full border border-white/80" style={{ backgroundColor: color }} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.article>
  );
}
```

## Task 8: Mobile Action Bar

**Files:**
- Create: `src/components/home/MobileActionBar.tsx`

- [ ] **Step 1: Create the mobile-only bottom action bar**

Create `src/components/home/MobileActionBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { mobileActions } from "./home-data";

const spring = { type: "spring", stiffness: 150, damping: 22 };

export function MobileActionBar() {
  return (
    <motion.nav
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="fixed inset-x-4 bottom-3 z-50 rounded-[1.5rem] border border-white/70 bg-white/78 p-2 shadow-2xl shadow-[rgba(77,74,115,0.2)] backdrop-blur-2xl md:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      aria-label="移动端首页快捷操作"
    >
      <div className="grid grid-cols-3 gap-2">
        {mobileActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-[var(--brand-deep)] transition active:scale-95 active:bg-[var(--brand-wash)]"
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
```

- [ ] **Step 2: Confirm mobile spacing is handled by `HomeDashboard`**

Do not add global body padding. The dashboard container will include `pb-[calc(5rem+env(safe-area-inset-bottom))]`.

## Task 9: Compose Home Dashboard And Page

**Files:**
- Create: `src/components/home/HomeDashboard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `HomeDashboard`**

Create `src/components/home/HomeDashboard.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import type { SeasonProfile } from "@/lib/seasons";
import { ColorQuizCard } from "./ColorQuizCard";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { HeroBanner } from "./HeroBanner";
import { MobileActionBar } from "./MobileActionBar";
import { PaletteExplorer } from "./PaletteExplorer";
import { SeasonPreviewStack } from "./SeasonPreviewStack";
import { StyleDashboard } from "./StyleDashboard";

const spring = { type: "spring", stiffness: 150, damping: 22 };

interface HomeDashboardProps {
  seasons: SeasonProfile[];
}

export function HomeDashboard({ seasons }: HomeDashboardProps) {
  return (
    <main className="watercolor-wash min-h-screen overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <Navbar />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring} className="pointer-events-none absolute inset-0 -z-10 opacity-80" />
        <HeroBanner />
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-5">
            <ColorQuizCard />
            <PaletteExplorer />
          </div>
          <div className="grid gap-5">
            <StyleDashboard />
            <SeasonPreviewStack seasons={seasons} />
          </div>
        </section>
        <DashboardQuickActions />
      </div>
      <MobileActionBar />
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx` with a thin composition**

Update `src/app/page.tsx`:

```tsx
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { SEASONS } from "@/lib/seasons";

export default function Home() {
  return <HomeDashboard seasons={Object.values(SEASONS)} />;
}
```

- [ ] **Step 3: Confirm old homepage route links still exist**

Search for these strings in `components/home` and `src/app/page.tsx`:

```text
/upload
/outfit
/history
/profile/style
```

Expected: links exist in the new dashboard components.

## Task 10: Build Verification And Visual Review

**Files:**
- No source edits expected unless verification fails.

- [ ] **Step 1: Run production build**

Run:

```bash
npm run build
```

Expected: exit code `0`, with Next.js compiling successfully.

- [ ] **Step 2: If TypeScript flags motion transition object typing, inline the transition**

If build fails because the shared `spring` object widens `type` to `string`, update each local spring constant to:

```ts
const spring = { type: "spring" as const, stiffness: 150, damping: 22 };
```

Then rerun:

```bash
npm run build
```

Expected: exit code `0`.

- [ ] **Step 3: Start local dev server for browser visual checks**

Run:

```bash
npm run dev
```

Expected: local Next.js URL appears, commonly `http://localhost:3000`.

- [ ] **Step 4: Check desktop viewport**

Open the home page at the local URL.

Expected desktop behavior:

- Hero is visible above the fold.
- Dashboard cards form a balanced multi-column layout.
- Watercolor background is CSS-rendered and not image-dependent.
- No text overlaps cards.
- Hovering cards lifts subtly with spring motion.

- [ ] **Step 5: Check mobile viewport**

Use browser responsive mode around `390x844`.

Expected mobile behavior:

- Cards become full-width.
- Bottom action bar is fixed and does not cover final content.
- Main container has `pb-[calc(5rem+env(safe-area-inset-bottom))]`.
- Tap targets are comfortable.
- No long Chinese text escapes its card.

- [ ] **Step 6: Final Git status check**

Run:

```bash
git status --short
```

Expected tracked changes include only planned source files, the design doc, the plan doc, and the pre-existing `MEMORY.md` local change.

## Self-Review

- Spec coverage:
  - App-like dashboard entry point: Tasks 3-9.
  - Preserve multi-page routes: Tasks 2, 3, 5, 8, 9.
  - Componentized architecture: Tasks 2-9.
  - Morandi monochrome watercolor palette: Task 1.
  - Lightweight glassmorphism: Task 1 and all card components.
  - Spring motion and `layoutId`: Tasks 3-9, especially Tasks 4 and 6.
  - CSS radial-gradient background and hardware acceleration: Task 1.
  - Mobile bottom action bar and safe-area spacing: Tasks 8 and 9.
  - Tablet two-column layout: Task 9.
  - Build and visual verification: Task 10.
- Placeholder scan:
  - No `TBD`, `TODO`, or unspecified implementation steps.
- Type consistency:
  - `SeasonProfile[]` flows from `page.tsx` to `HomeDashboard` to `SeasonPreviewStack`.
  - Route data objects are centralized in `home-data.ts`.
  - Framer Motion transition constants use the same spring values throughout.
