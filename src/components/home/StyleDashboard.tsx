import Link from "next/link";
import { ArrowUpRight, Gauge, Shirt, Sparkle } from "lucide-react";

const metrics = [
  { label: "冷暖线索", value: "偏暖", width: "72%" },
  { label: "明度倾向", value: "中高", width: "64%" },
  { label: "饱和度", value: "柔和", width: "58%" },
];

export function StyleDashboard() {
  return (
    <article className="glass-card gpu-safe rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#a9877e]">风格面板</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#2f3432]">把诊断结果转成穿搭动作</h2>
        </div>
        <Gauge className="h-6 w-6 text-[#7f8f86]" aria-hidden="true" />
      </div>

      <div className="mt-5 space-y-4 rounded-3xl bg-white/52 p-5">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#5f6662]">{metric.label}</span>
              <span className="font-semibold text-[#2f3432]">{metric.value}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#e6e3dc]">
              <div className="h-full rounded-full bg-[#7f8f86]" style={{ width: metric.width }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/outfit" className="flex items-center justify-between rounded-2xl bg-white/62 p-4 font-semibold text-[#4e5d58] ring-1 ring-white/70 hover:bg-white">
          <span className="flex items-center gap-2">
            <Shirt className="h-5 w-5" aria-hidden="true" />
            今日 OOTD
          </span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link href="/profile/style" className="flex items-center justify-between rounded-2xl bg-white/62 p-4 font-semibold text-[#7d655f] ring-1 ring-white/70 hover:bg-white">
          <span className="flex items-center gap-2">
            <Sparkle className="h-5 w-5" aria-hidden="true" />
            风格档案
          </span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
