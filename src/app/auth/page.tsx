import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto flex max-w-md flex-col px-6 py-16">
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-100">
          <p className="text-sm font-semibold text-indigo-700">P02 注册 / 登录</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">欢迎来到 ColorSense</h1>
          <p className="mt-3 leading-7 text-slate-600">MVP 阶段先保留表单骨架。接入 Supabase 后，这里会支持邮箱登录、邮箱注册和 Google OAuth。</p>
          <form className="mt-6 space-y-4">
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="邮箱" type="email" />
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="密码" type="password" />
            <button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white" type="button">
              登录 / 注册
            </button>
          </form>
          <Link className="mt-5 inline-flex text-sm font-semibold text-indigo-700" href="/upload">
            先查看上传页
          </Link>
        </div>
      </section>
    </main>
  );
}
