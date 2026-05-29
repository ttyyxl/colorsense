"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FileUser, History, LogOut, Settings, UserCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";

const navItems = [
  { href: "/upload", label: "开始诊断" },
  { href: "/history", label: "历史记录" },
];

export function Navbar() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentUser, isAuthenticated, logout: firebaseLogout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountLabel = currentUser?.displayName?.trim() || currentUser?.email || "已登录用户";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function logout() {
    setMenuOpen(false);
    await firebaseLogout();
    router.push("/login");
    router.refresh();
  }

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
          {isAuthenticated ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex max-w-56 items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-indigo-50 hover:text-indigo-700"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {currentUser?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentUser.photoURL} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <UserCircle className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                )}
                <span className="max-w-32 truncate">{accountLabel}</span>
                <ChevronDown className={`h-4 w-4 transition ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-xl"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500">当前账户</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{accountLabel}</p>
                  </div>
                  <div className="p-2">
                    <AccountMenuLink href="/profile/portrait" label="查看个人肖像档案" icon={<FileUser className="h-4 w-4" />} onClick={() => setMenuOpen(false)} />
                    <AccountMenuLink href="/history" label="历史诊断记录" icon={<History className="h-4 w-4" />} onClick={() => setMenuOpen(false)} />
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-400"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      设置
                    </button>
                  </div>
                  <div className="border-t border-slate-100 p-2">
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              登录 / 注册
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

function AccountMenuLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
    >
      {icon}
      {label}
    </Link>
  );
}
