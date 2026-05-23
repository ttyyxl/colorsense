import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { UploadZone } from "@/components/UploadZone";

const tips = ["正面直视镜头", "自然光或均匀灯光", "不要戴墨镜或口罩", "文件大小不超过 10MB"];

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-indigo-50">
      <Navbar />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold text-indigo-700">P03 上传页</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-950">上传一张清晰正面照</h1>
        <p className="mt-4 text-slate-600">先把上传体验跑通，下一阶段会连接 Supabase Storage 和推理服务。</p>
        <div className="mt-8">
          <UploadZone />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {tips.map((tip) => (
            <div key={tip} className="rounded-xl border border-indigo-100 bg-white p-4 text-sm font-medium text-slate-700">
              {tip}
            </div>
          ))}
        </div>
        <Link href="/processing" className="mt-8 inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white">
          开始诊断
        </Link>
      </section>
    </main>
  );
}
