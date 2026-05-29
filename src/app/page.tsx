import Link from "next/link";
import { ColorPalette } from "@/components/ColorPalette";
import { Navbar } from "@/components/Navbar";
import { SeasonCard } from "@/components/SeasonCard";
import { SEASONS } from "@/lib/seasons";

const features = [
  {
    title: "AI 精准诊断",
    description: "从人脸关键点中提取肤色特征，用 LAB 色彩空间完成四季型初判。",
  },
  {
    title: "专属配色方案",
    description: "每个结果都带有推荐色卡、风格关键词和需要谨慎使用的颜色。",
  },
  {
    title: "个性风格建议",
    description: "为中文用户生成更自然的穿搭说明，适合保存和分享。",
  },
];

export default function Home() {
  const seasons = Object.values(SEASONS);

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-white">
      <Navbar />
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.05fr_0.95fr] md:items-center">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700">
            AI 四季色彩诊断 · 中文体验优先
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-slate-950 md:text-6xl">
            上传照片，发现属于你的色彩。
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            ColorSense 帮你从肤色特征出发，快速判断春、夏、秋、冬四季型，并生成适合保存分享的色卡和风格建议。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
            >
              立即诊断
            </Link>
            <Link
              href="/history"
              className="rounded-xl border border-indigo-200 bg-white px-6 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              查看历史
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-indigo-100 bg-white/80 p-5 shadow-xl shadow-indigo-100">
          <SeasonCard season={SEASONS.spring} confidence={0.89} />
          <div className="mt-5">
            <ColorPalette colors={SEASONS.spring.palette} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">{feature.title}</h2>
            <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-2xl font-semibold text-slate-950">四季型示例</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {seasons.map((season) => (
            <SeasonCard key={season.nameEn} season={season} compact confidence={0.82} />
          ))}
        </div>
      </section>
    </main>
  );
}
