"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FileUser, LogOut, Settings, UserCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";

const navItems = [
  { href: "/", label: "返回首页" },
  { href: "/community", label: "美学社区" },
  { href: "/upload", label: "开始诊断" },
  { href: "/outfit", label: "穿搭灵感" },
  { href: "/history", label: "历史记录" },
];

export function Navbar() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const { accountLabel, currentUser, isAuthenticated, logout: firebaseLogout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <header className="relative z-[100] overflow-visible border-b border-[#81bfe9]/14 bg-white/48 backdrop-blur-[20px]">
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between overflow-visible px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold text-[#181698]">
          ColorSense
        </Link>
        <div className="hidden items-center gap-1.5 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-sm font-medium text-[#667694]/75 hover:bg-white/48 hover:text-[#181698]">
              {item.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex max-w-56 items-center gap-2 rounded-xl border border-[#81bfe9]/22 bg-white/46 px-3 py-2 text-sm font-semibold text-[#181698] shadow-sm hover:bg-white/66"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {currentUser?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentUser.photoURL} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <UserCircle className="h-5 w-5 text-[#578af4]" aria-hidden="true" />
                )}
                <span className="max-w-32 truncate">{accountLabel}</span>
                <ChevronDown className={`h-4 w-4 transition ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              {menuOpen && (
                <div role="menu" className="absolute right-0 z-[120] mt-3 w-64 overflow-hidden rounded-2xl border border-[#81bfe9]/24 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500">当前账户</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{accountLabel}</p>
                  </div>
                  <div className="p-2">
                    <AccountMenuLink href="/profile/portrait" label="查看个人肖像档案" icon={<FileUser className="h-4 w-4" />} onClick={() => setMenuOpen(false)} />
                    <AccountMenuLink href="/settings" label="设置" icon={<Settings className="h-4 w-4" />} onClick={() => setMenuOpen(false)} />
                  </div>
                  <div className="border-t border-slate-100 p-2">
                    <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50">
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-xl border border-[#81bfe9]/28 bg-white/38 px-4 py-2 text-sm font-semibold text-[#181698] shadow-sm hover:bg-white/66">
              登录/注册
            </Link>
          )}
        </div>
        <Link href="/upload" className="rounded-xl border border-[#81bfe9]/28 bg-white/46 px-4 py-2 text-sm font-semibold text-[#181698] shadow-sm md:hidden">
          开始诊断
        </Link>
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
    <Link href={href} role="menuitem" onClick={onClick} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#eef6ff] hover:text-[#181698]">
      {icon}
      {label}
    </Link>
  );
}
