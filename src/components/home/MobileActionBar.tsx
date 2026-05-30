import Link from "next/link";
import type { HomeRouteAction } from "./home-data";

export function MobileActionBar({ actions }: { actions: HomeRouteAction[] }) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[20px] border border-[#81bfe9]/24 bg-white/72 px-3 py-2 shadow-[0_18px_48px_rgba(24,22,152,0.12)] backdrop-blur-[20px] md:hidden" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }} aria-label="移动端快捷操作">
      <div className="grid grid-cols-4 gap-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href + action.title} href={action.href} className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold ${action.tone} hover:bg-[#eef6ff]`}>
              <Icon className="mb-1 h-5 w-5" aria-hidden="true" />
              {action.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
