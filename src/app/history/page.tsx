import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SEASONS } from "@/lib/seasons";

export default function HistoryPage() {
  const season = SEASONS.spring;

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold text-indigo-700">P06 历史记录</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-950">你的诊断记录</h1>
        <Link href="/result/demo" className="mt-8 block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">示例记录</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                {season.emoji} {season.name}
              </h2>
            </div>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">89%</span>
          </div>
          <div className="mt-4 flex gap-2">
            {season.palette.map((color) => (
              <span key={color} className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
            ))}
          </div>
        </Link>
      </section>
    </main>
  );
}
