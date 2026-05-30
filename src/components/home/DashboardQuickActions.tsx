import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { HomeRouteAction } from "./home-data";

export function DashboardQuickActions({ routes }: { routes: HomeRouteAction[] }) {
  return (
    <section className="glass-card gpu-safe rounded-3xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#a9877e]">快捷入口</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#2f3432]">继续你的色彩流程</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {routes.map((route) => {
          const Icon = route.icon;
          return (
            <Link key={route.href + route.title} href={route.href} className="group flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/56 p-4 ring-1 ring-white/70 transition hover:bg-white">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className={`shrink-0 rounded-2xl p-3 ${route.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block break-words font-semibold text-[#2f3432]">{route.title}</span>
                  <span className="mt-1 block break-words text-sm text-[#666d69]">{route.description}</span>
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#7f8f86] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
