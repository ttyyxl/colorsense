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
    tone: "bg-[#578af4] text-white shadow-[0_20px_44px_rgba(87,138,244,0.28)]",
  },
  {
    title: "查看历史",
    description: "回看诊断记录与色彩建议",
    href: "/history",
    icon: History,
    tone: "bg-white/58 text-[#181698] ring-1 ring-[#81bfe9]/30",
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
    title: "清透蓝白日常",
    description: "雾蓝与水蓝铺底，适合干净轻盈的通勤前日常造型。",
    href: "/outfit",
    cta: "查看搭配",
    colors: ["#f8fbff", "#addce6", "#81bfe9", "#578af4", "#181698"],
  },
  {
    id: "work",
    label: "通勤",
    title: "冷静蓝灰通勤",
    description: "用深蓝建立轮廓，蓝灰降低距离感，显得专业但不沉闷。",
    href: "/outfit",
    cta: "生成灵感",
    colors: ["#eef6ff", "#bcc6d7", "#81bfe9", "#578af4", "#181698"],
  },
  {
    id: "date",
    label: "约会",
    title: "柔和水光约会",
    description: "浅水蓝和柔雾蓝制造亲和感，用主蓝保留一点清晰记忆点。",
    href: "/upload",
    cta: "立即诊断",
    colors: ["#ffffff", "#e5f5fb", "#addce6", "#81bfe9", "#578af4"],
  },
  {
    id: "party",
    label: "聚会",
    title: "高光深蓝聚会",
    description: "提高深浅对比，让蓝色系更有存在感，适合晚间或拍照场景。",
    href: "/outfit",
    cta: "查看场景",
    colors: ["#f4f8fe", "#addce6", "#578af4", "#2b43c7", "#181698"],
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
