import Link from "next/link";
import { ColorPalette } from "@/components/ColorPalette";
import { Navbar } from "@/components/Navbar";
import { SeasonCard } from "@/components/SeasonCard";
import { ShareModal } from "@/components/ShareModal";
import { SEASONS } from "@/lib/seasons";

interface ResultPageProps {
  params: { id: string };
}

export default function ResultPage({ params }: ResultPageProps) {
  const { id } = params;
  const season = SEASONS.spring;

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm font-semibold text-indigo-700">P05 结果页 · {id}</p>
        <div id="share-card" className="mt-4 space-y-6">
          <SeasonCard season={season} confidence={0.89} />
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">推荐穿搭色系</h2>
            <div className="mt-5">
              <ColorPalette colors={season.palette} />
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">风格建议</h2>
            <p className="mt-4 leading-8 text-slate-600">{season.styleDesc}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {season.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                  {keyword}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm text-slate-500">谨慎使用：{season.avoid.join(" / ")}</p>
          </section>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <ShareModal />
          <Link href="/upload" className="rounded-2xl border border-indigo-100 bg-white p-5 font-semibold text-indigo-700">
            重新诊断
          </Link>
          <Link href="/history" className="rounded-2xl border border-indigo-100 bg-white p-5 font-semibold text-indigo-700">
            查看历史
          </Link>
        </div>
      </section>
    </main>
  );
}
