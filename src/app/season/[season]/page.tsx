import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";
import { SEASON_INTRODUCTIONS } from "@/lib/season-introductions";
import { SEASONS, type SeasonType } from "@/lib/seasons";

const seasonOrder: SeasonType[] = ["spring", "summer", "autumn", "winter"];

function isSeasonType(value: string): value is SeasonType {
  return seasonOrder.includes(value as SeasonType);
}

export function generateStaticParams() {
  return seasonOrder.map((season) => ({ season }));
}

export default function SeasonDetailPage({ params }: { params: { season: string } }) {
  if (!isSeasonType(params.season)) {
    notFound();
  }

  const season = SEASONS[params.season];
  const detail = SEASON_INTRODUCTIONS[params.season];

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-white">
      <Navbar />
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                四季型详情
              </p>
              <h1 className="mt-4 text-4xl font-bold text-slate-950">
                {season.emoji} {detail.title}
              </h1>
              <p className="mt-3 text-lg text-slate-600">{detail.subtitle}</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回首页
            </Link>
          </div>

          <section className="grid gap-4 rounded-2xl bg-slate-50 p-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-xl font-bold text-slate-950">本季型概述</h2>
              <p className="mt-3 leading-7 text-slate-700">{detail.overview}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.coreTraits.map((item) => (
                  <span key={item} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <h3 className="text-base font-bold text-slate-950">参考色板</h3>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {season.palette.slice(0, 6).map((color) => (
                  <div key={color} className="space-y-2">
                    <span className="block h-12 rounded-xl border border-slate-200" style={{ backgroundColor: color }} />
                    <p className="text-center text-xs font-semibold text-slate-500">{color}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-slate-950">穿搭要点</h2>
                <p className="mt-2 max-w-3xl leading-7 text-slate-700">{detail.stylingSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.stylingFocus.map((item) => (
                    <span key={item} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">案例分析</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {detail.celebrityCases.map((item) => (
                <article key={item.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-indigo-700">{item.name}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">案例</span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-950">{item.feature}</h3>
                  <p className="mt-3 text-sm font-semibold text-slate-500">适合色彩 / 穿搭风格</p>
                  <p className="mt-1 leading-7 text-slate-700">{item.colorsAndStyle}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-500">为什么符合该季型</p>
                  <p className="mt-1 leading-7 text-slate-700">{item.whyItFits}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
      <FooterGradient />
    </main>
  );
}
