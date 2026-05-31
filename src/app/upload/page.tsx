"use client";

import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { UploadZone } from "@/components/UploadZone";
import { FooterGradient } from "@/components/home/FooterGradient";
import dynamic from "next/dynamic";

// 动态导入 motion.div，禁用 SSR
const MotionDiv = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.div),
  { ssr: false }
);

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const;

const tips = ["正面直视镜头", "自然光或均匀灯光", "不要戴墨镜或口罩", "文件大小不超过 10MB"];

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <main className="home-dashboard-shell min-h-screen text-[#181698]">
        <Navbar />
        <MotionDiv
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="mx-auto flex w-full max-w-7xl flex-col gap-18 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:gap-20 md:pb-20 lg:pt-8"
        >
          <section className="mx-auto max-w-4xl px-6 py-12">
            <h1 className="mt-2 text-4xl font-extrabold leading-tight text-[#181698]">
              上传一张清晰正面照
            </h1>
            <p className="mt-4 max-w-xl text-base font-light leading-8 text-[#667694]">
              上传后会调用诊断接口；如果本地 Python 推理服务还没启动，会先用后端 fallback 结果跑通完整链路。
            </p>
            <div className="mt-8">
              <UploadZone />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {tips.map((tip) => (
                <div key={tip} className="glass-card rounded-[20px] p-4 text-sm font-medium text-[#667694]">
                  {tip}
                </div>
              ))}
            </div>
          </section>
        </MotionDiv>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}