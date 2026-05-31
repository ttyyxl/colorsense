import { motion } from "framer-motion";
import Link from "next/link";
import type { SeasonProfile } from "@/lib/seasons";

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const;

const seasonCopy: Record<
  string,
  {
    emoji: string;
    zhName: string;
    enName: string;
    description: string;
    keywords: string[];
    attribute: string;
    colors: string[];
    cardBg: string;
    glow: string;
  }
> = {
  Spring: {
    emoji: "🌷",
    zhName: "春型",
    enName: "Spring",
    description: "明亮轻盈，适合带有阳光感的清透色彩。",
    keywords: ["清透", "轻盈", "暖亮"],
    attribute: "明亮 / 生机",
    colors: ["#FFB08A", "#9DCE6D", "#F5D35C"],
    cardBg: "linear-gradient(145deg, rgba(255, 244, 232, 0.72), rgba(255, 255, 255, 0.44))",
    glow: "rgba(255, 176, 138, 0.2)",
  },
  Summer: {
    emoji: "🫧",
    zhName: "夏型",
    enName: "Summer",
    description: "柔和冷调，适合低对比的雾面蓝粉色系。",
    keywords: ["柔雾", "冷调", "优雅"],
    attribute: "柔雾 / 清雅",
    colors: ["#A9C7E8", "#C9B4DF", "#DDBFD1"],
    cardBg: "linear-gradient(145deg, rgba(235, 243, 255, 0.72), rgba(250, 247, 255, 0.44))",
    glow: "rgba(169, 199, 232, 0.24)",
  },
  Autumn: {
    emoji: "🍂",
    zhName: "秋型",
    enName: "Autumn",
    description: "温润浓郁，适合自然感与低饱和暖色。",
    keywords: ["温润", "浓郁", "自然"],
    attribute: "温润 / 沉稳",
    colors: ["#9A6138", "#C96B3E", "#C8A338"],
    cardBg: "linear-gradient(145deg, rgba(246, 232, 211, 0.7), rgba(255, 255, 255, 0.42))",
    glow: "rgba(201, 107, 62, 0.18)",
  },
  Winter: {
    emoji: "❄️",
    zhName: "冬型",
    enName: "Winter",
    description: "清冷利落，适合高对比和更清晰的色彩边界。",
    keywords: ["清冷", "高对比", "利落"],
    attribute: "冷冽 / 纯粹",
    colors: ["#1B2D8F", "#E91B4C", "#F4F8FF"],
    cardBg: "linear-gradient(145deg, rgba(232, 239, 249, 0.74), rgba(255, 255, 255, 0.46))",
    glow: "rgba(87, 138, 244, 0.2)",
  },
};

export function SeasonPreviewStack({ seasons }: { seasons: SeasonProfile[] }) {
  return (
    <section className="glass-card gpu-safe relative overflow-hidden rounded-[20px] p-6 sm:p-7 lg:p-8">
      <div className="absolute left-8 top-8 h-36 w-36 rounded-full bg-[#addce6]/22 blur-3xl" />
      <div className="absolute bottom-8 right-12 h-44 w-44 rounded-full bg-[#578af4]/10 blur-3xl" />

      <div className="relative mb-7 max-w-3xl">
        <p className="text-sm font-semibold text-[#578af4]">四季型预览</p>
        <h2 className="mt-2 text-3xl font-bold text-[#181698]">用四种色彩气质理解你的方向</h2>
        <p className="mt-3 text-base font-light leading-7 text-[#667694]">每一种季型都不是标签，而是一组更适合你的明度、冷暖和对比关系。</p>
      </div>

      <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {seasons.map((season, index) => {
          const copy = seasonCopy[season.nameEn] ?? {
            emoji: "✨",
            zhName: season.name,
            enName: season.nameEn,
            description: season.description,
            keywords: ["色彩", "风格", "档案"],
            attribute: "色彩 / 档案",
            colors: season.palette.slice(0, 3),
            cardBg: "linear-gradient(145deg, rgba(255,255,255,0.68), rgba(238,246,255,0.44))",
            glow: "rgba(129, 191, 233, 0.22)",
          };
          const detailHref = `/season/${season.nameEn.toLowerCase()}`;

          return (
            <Link key={season.nameEn} href={detailHref} className="block outline-none">
              <motion.article
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springTransition, delay: index * 0.04 }}
                className="gpu-safe relative min-h-72 overflow-hidden rounded-[20px] border border-white/56 p-6 shadow-[0_24px_54px_-34px_rgba(24,22,152,0.22)] transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#578af4]/30"
                style={{ background: copy.cardBg }}
                aria-label={`查看 ${copy.zhName} 详细介绍`}
              >
                <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full blur-3xl" style={{ backgroundColor: copy.glow }} />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-3xl" aria-hidden="true">
                        {copy.emoji}
                      </span>
                      <h3 className="mt-4 text-xl font-bold text-[#181698]">{copy.zhName}</h3>
                      <p className="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-[#578af4]">{copy.enName}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-white/52 p-1.5 ring-1 ring-[#81bfe9]/20">
                      {copy.colors.map((color) => (
                        <span key={color} className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-white/70" style={{ backgroundColor: color }} title={color} />
                      ))}
                    </div>
                  </div>

                  <span className="mt-5 inline-flex w-fit rounded-xl bg-white/46 px-3 py-1.5 text-xs font-semibold text-[#181698] ring-1 ring-[#81bfe9]/18">
                    {copy.attribute}
                  </span>
                  <p className="mt-4 text-sm font-light leading-6 text-[#667694]">{copy.description}</p>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                    <div className="grid flex-1 grid-cols-3 gap-2">
                      {copy.keywords.map((keyword) => (
                        <span key={keyword} className="rounded-xl bg-[#eef6ff]/72 px-3 py-2 text-center text-xs font-semibold text-[#181698] ring-1 ring-[#81bfe9]/18">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-[#578af4]">查看详情</span>
                  </div>
                </div>
              </motion.article>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
