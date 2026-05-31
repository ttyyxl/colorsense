import { Navbar } from "@/components/Navbar";
import { FooterGradient } from "@/components/home/FooterGradient";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StyleProfileForm } from "@/components/profile/StyleProfileForm";

export default function OnboardingStyleProfilePage() {
  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(129,191,233,0.28),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_45%,#f6f2ff_100%)]">
        <Navbar />
        <section className="relative mx-auto w-full max-w-4xl flex-1 px-6 py-10">
          <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-[#81bfe9]/20 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-sm font-semibold text-indigo-700">个人形象问卷</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">完善你的个人形象信息</h1>
            <p className="mt-4 leading-7 text-slate-600">
              必填信息用于保存并开始诊断，选填信息会用于后续 AI 个性化档案生成。不确定的外貌信息可以先留空，之后也可以回来修改。
            </p>
          </div>
          <div className="relative mt-8">
            <StyleProfileForm redirectPath="/upload" submitLabel="保存并开始诊断" />
          </div>
        </section>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}
