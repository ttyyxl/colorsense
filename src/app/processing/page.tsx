import Link from "next/link";

const steps = ["正在检测人脸轮廓", "分析肤色特征", "匹配色彩季型", "生成专属建议"];

export default function ProcessingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-6">
      <section className="w-full max-w-lg text-center">
        <div className="mx-auto h-28 w-28 animate-pulse rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-xl shadow-indigo-200" />
        <h1 className="mt-8 text-3xl font-bold text-slate-950">正在生成你的色彩报告</h1>
        <div className="mt-8 grid gap-3">
          {steps.map((step, index) => (
            <div key={step} className="rounded-xl border border-indigo-100 bg-white px-4 py-3 text-left text-slate-700">
              {index + 1}. {step}...
            </div>
          ))}
        </div>
        <Link href="/result/demo" className="mt-8 inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white">
          查看示例结果
        </Link>
      </section>
    </main>
  );
}
