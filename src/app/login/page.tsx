import { AuthForm } from "@/components/AuthForm";
import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";

interface LoginPageProps {
  searchParams?: { next?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const requestedNext = searchParams?.next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/upload";

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto flex max-w-xl flex-col px-6 py-12 sm:py-16">
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-100 sm:p-8">
          <p className="text-sm font-semibold text-indigo-700">账号注册与登录</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">欢迎来到 ColorSense</h1>
          <p className="mt-3 leading-7 text-slate-600">
            新用户通过邮箱验证链接完成注册；已有账号可直接使用邮箱和密码登录。
          </p>
          <AuthForm nextPath={nextPath} />
        </div>
      </section>
      <FooterGradient />
    </main>
  );
}
