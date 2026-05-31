import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StyleProfileForm } from "@/components/profile/StyleProfileForm";

export default function OnboardingStyleProfilePage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
        <Navbar />
        <section className="mx-auto max-w-4xl px-6 py-10">
          <h1 className="mt-2 text-3xl font-bold text-slate-950">完善你的个人形象信息</h1>
          <p className="mt-4 leading-7 text-slate-600">
            必填信息用于保存并开始诊断，选填信息会预留给后续 AI 个性化档案生成。不确定的外貌信息可以留空。
          </p>
          <div className="mt-8">
            <StyleProfileForm redirectPath="/upload" submitLabel="保存并开始诊断" />
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}
