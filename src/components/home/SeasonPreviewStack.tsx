import { motion } from "framer-motion";
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
    glow: string;
  }
> = {
  Spring: {
    emoji: "🌷",
    zhName: "春型",
    enName: "Spring",
    description: "明亮轻盈，适合带有阳光感的清透色彩。",
    keywords: ["清透", "轻盈", "暖亮"],
    glow: "rgba(255, 214, 107, 0.22)",
  },
  Summer: {
    emoji: "🫧",
    zhName: "夏型",
    enName: "Summer",
    description: "柔和冷调，适合低对比的雾面蓝粉色系。",
    keywords: ["柔雾", "冷调", "优雅"],
    glow: "rgba(129, 191, 233, 0.24)",
  },
  Autumn: {
    emoji: "🍂",
    zhName: "秋型",
    enName: "Autumn",
    description: "温润浓郁，适合自然感和低饱和暖色。",
    keywords: ["温润", "浓郁", "自然"],
    glow: "rgba(216, 163, 93, 0.18)",
  },
  Winter: {
    emoji: "❄️",
    zhName: "冬型",
    enName: "Winter",
    description: "清冷利落，适合高对比和更清晰的色彩边界。",
    keywords: ["清冷", "高对比", "利落"],
    glow: "rgba(87, 138, 244, 0.22)",
  },
};

export function SeasonPreviewStack({ seasons }: { seasons: SeasonProfile[] }) {
  return (
    <section className="py-10 md:py-12">
      <div className="mb-7 max-w-3xl">
        <p className="text-sm font-semibold text-[#578af4]">四季型预览</p>
        <h2 className="mt-2 text-3xl font-bold text-[#181698]">用四种色彩气质理解你的方向</h2>
        <p className="mt-3 text-base font-light leading-7 text-[#667694]">每一种季型都不是标签，而是一组更适合你的明度、冷暖和对比关系。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {seasons.map((season, index) => {
          const copy = seasonCopy[season.nameEn] ?? {
            emoji: "✨",
            zhName: season.name,
            enName: season.nameEn,
            description: season.description,
            keywords: ["色彩", "风格", "档案"],
            glow: "rgba(129, 191, 233, 0.22)",
          };

          return (
            <motion.article
              key={season.nameEn}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springTransition, delay: index * 0.04 }}
              className="glass-card gpu-safe relative min-h-64 overflow-hidden rounded-[20px] p-6 transition hover:-translate-y-1"
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl" style={{ backgroundColor: copy.glow }} />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-3xl" aria-hidden="true">
                      {copy.emoji}
                    </span>
                    <h3 className="mt-4 text-xl font-bold text-[#181698]">{copy.zhName}</h3>
                    <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-[#578af4]">{copy.enName}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/48 p-1 ring-1 ring-[#81bfe9]/20">
                    {season.palette.slice(0, 3).map((color) => (
                      <span key={color} className="h-8 w-8 rounded-lg" style={{ backgroundColor: color }} title={color} />
                    ))}
                  </div>
                </div>

                <p className="mt-5 text-sm font-light leading-6 text-[#667694]">{copy.description}</p>

                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  {copy.keywords.map((keyword) => (
                    <span key={keyword} className="rounded-xl bg-white/46 px-3 py-1.5 text-xs font-semibold text-[#181698] ring-1 ring-[#81bfe9]/18">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
