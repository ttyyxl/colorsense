import Link from "next/link";

const navItems = [
  { href: "/upload", label: "开始诊断" },
  { href: "/history", label: "历史记录" },
];

export function Navbar() {
  return (
    <header className="border-b border-indigo-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-bold text-indigo-700">
          ColorSense
        </Link>
        <div className="flex items-center gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
              {item.label}
            </Link>
          ))}
          <Link href="/auth" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            登录
          </Link>
        </div>
      </nav>
    </header>
  );
}
