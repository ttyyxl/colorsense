import { CalendarHeart, Camera, History, Palette, Shirt, Sparkles, WandSparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HomeRouteAction = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

export type QuizPreviewStep = {
  id: string;
  label: string;
  title: string;
  detail: string;
};

export type PaletteGroup = {
  id: string;
  label: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  colors: string[];
};

export const primaryActions: HomeRouteAction[] = [
  {
    title: "立即诊断",
    description: "上传照片，生成个人色彩档案",
    href: "/upload",
    icon: Camera,
    tone: "bg-[#578af4] text-white shadow-[0_20px_44px_rgba(87,138,244,0.28)] hover:bg-[#181698]",
  },
  {
    title: "穿搭灵感",
    description: "把色彩档案转成日常搭配",
    href: "/outfit",
    icon: Shirt,
    tone: "bg-white/46 text-[#181698] ring-1 ring-[#81bfe9]/34 hover:bg-white/72",
  },
  {
    title: "查看历史",
    description: "回看诊断记录与色彩建议",
    href: "/history",
    icon: History,
    tone: "bg-white/46 text-[#181698] ring-1 ring-[#81bfe9]/34 hover:bg-white/72",
  },
];

export const dashboardRoutes: HomeRouteAction[] = [
  {
    title: "历史记录",
    description: "回看诊断结果与色卡",
    href: "/history",
    icon: History,
    tone: "bg-white/64 text-[#181698]",
  },
  {
    title: "穿搭灵感",
    description: "把色彩档案转成日常搭配",
    href: "/outfit",
    icon: Shirt,
    tone: "bg-white/64 text-[#578af4]",
  },
  {
    title: "开始诊断",
    description: "进入上传与分析流程",
    href: "/upload",
    icon: Palette,
    tone: "bg-white/64 text-[#81bfe9]",
  },
];

export const quizPreviewSteps: QuizPreviewStep[] = [
  {
    id: "photo",
    label: "01",
    title: "上传自然光照片",
    detail: "从面部色彩线索开始，减少环境色干扰。",
  },
  {
    id: "season",
    label: "02",
    title: "识别个人色彩",
    detail: "用冷暖、明度与纯度建立你的色彩坐标。",
  },
  {
    id: "style",
    label: "03",
    title: "生成搭配灵感",
    detail: "把色卡转成服饰、妆容和场景建议。",
  },
];

export const paletteGroups: PaletteGroup[] = [
  {
    id: "daily",
    label: "日常",
    title: "轻松日常色",
    description: "以舒适、放松、耐看为主，适合基础衣橱和高频日常穿搭。",
    href: "/outfit",
    cta: "查看搭配",
    colors: ["#EAF1F8", "#F2E9DC", "#C9B59A", "#A8B7A1"],
  },
  {
    id: "work",
    label: "通勤",
    title: "冷静通勤色",
    description: "强调专业、干净和秩序感，适合办公室与正式场合。",
    href: "/outfit",
    cta: "生成灵感",
    colors: ["#2E4E86", "#243A63", "#A7AFBC", "#F6F8FB"],
  },
  {
    id: "date",
    label: "约会",
    title: "温柔约会色",
    description: "更柔和、更有亲和力，适合轻松与带一点情绪感的场景。",
    href: "/upload",
    cta: "立即诊断",
    colors: ["#7EA6E6", "#F3C2B4", "#F8F1E7", "#D9CCE8"],
  },
  {
    id: "party",
    label: "聚会",
    title: "高光聚会色",
    description: "提高视觉存在感和对比度，适合夜间、拍照和聚会社交场景。",
    href: "/outfit",
    cta: "查看场景",
    colors: ["#2643C4", "#B5BDC8", "#7A2E38", "#F5F8FC"],
  },
];

export const mobileActions: HomeRouteAction[] = [
  {
    title: "诊断",
    description: "上传",
    href: "/upload",
    icon: WandSparkles,
    tone: "text-[#181698]",
  },
  {
    title: "穿搭",
    description: "OOTD",
    href: "/outfit",
    icon: CalendarHeart,
    tone: "text-[#578af4]",
  },
  {
    title: "记录",
    description: "历史",
    href: "/history",
    icon: History,
    tone: "text-[#181698]",
  },
  {
    title: "色卡",
    description: "灵感",
    href: "/outfit",
    icon: Sparkles,
    tone: "text-[#578af4]",
  },
];
