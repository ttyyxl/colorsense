export type SeasonType = "spring" | "summer" | "autumn" | "winter";

export interface SeasonProfile {
  name: string;
  nameEn: string;
  emoji: string;
  description: string;
  labRange: {
    L: [number, number];
    a: [number, number];
    b: [number, number];
  };
  palette: string[];
  keywords: string[];
  avoid: string[];
  styleDesc: string;
  accent: string;
}

export const SEASONS: Record<SeasonType, SeasonProfile> = {
  spring: {
    name: "春型",
    nameEn: "Spring",
    emoji: "🌸",
    description: "温暖明亮，如春日阳光般清透活泼",
    labRange: { L: [60, 85], a: [5, 18], b: [10, 22] },
    palette: ["#FFB5A7", "#FFC9A0", "#FFE5A0", "#C8F0C0", "#B0D8FF", "#FFD4E8"],
    keywords: ["清新", "温暖", "明朗", "活泼", "甜美"],
    avoid: ["黑色", "深咖色", "冷灰色", "荧光色"],
    styleDesc: "适合轻盈、甜美、减龄的穿搭风格，春日碎花、浅色条纹、轻薄雪纺是你的好朋友。",
    accent: "#FF8FAB",
  },
  summer: {
    name: "夏型",
    nameEn: "Summer",
    emoji: "🌊",
    description: "冷色调柔和，如薰衣草田般优雅宁静",
    labRange: { L: [58, 80], a: [-8, 5], b: [-12, 5] },
    palette: ["#D4B8E0", "#B8D4E8", "#E8C8D8", "#C8D8F0", "#D8E8D8", "#F0D8E8"],
    keywords: ["优雅", "柔和", "知性", "浪漫", "雾感"],
    avoid: ["橙色", "黄色", "大地色", "高饱和暖色"],
    styleDesc: "适合雾面质感、柔和色调的穿搭，薰衣草紫、烟粉、冰蓝色系最能凸显你的气质。",
    accent: "#A78BFA",
  },
  autumn: {
    name: "秋型",
    nameEn: "Autumn",
    emoji: "🍂",
    description: "暖色深沉，如秋日落叶般成熟大气",
    labRange: { L: [38, 62], a: [8, 22], b: [14, 28] },
    palette: ["#C47B4E", "#A85C3A", "#8B7355", "#6B8C5A", "#C4A046", "#7B4E6B"],
    keywords: ["成熟", "大气", "温暖", "复古", "稳重"],
    avoid: ["粉色", "冷蓝", "亮白", "银色"],
    styleDesc: "大地色系、厚实质感最适合你，焦糖棕、橄榄绿、砖红色系能完美衬托你的温暖气场。",
    accent: "#D97706",
  },
  winter: {
    name: "冬型",
    nameEn: "Winter",
    emoji: "❄️",
    description: "冷色高对比，如冬日冰雪般干净锐利",
    labRange: { L: [20, 45], a: [-15, 3], b: [-15, 5] },
    palette: ["#1A1A2E", "#16213E", "#DC143C", "#00008B", "#006400", "#F5F5F5"],
    keywords: ["干练", "高级", "冷峻", "个性", "都市"],
    avoid: ["暖棕", "橙色", "米色", "柔和粉"],
    styleDesc: "你天生适合高对比度的穿搭，纯黑纯白、宝蓝酒红都能让你气场全开。简约剪裁是你的核心美学。",
    accent: "#1D4ED8",
  },
};
