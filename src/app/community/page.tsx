"use client";

import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FooterGradient } from "@/components/home/FooterGradient";

export default function CommunityPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen text-[#181698]">
        <Navbar />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-18 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:gap-20 md:pb-20 lg:pt-8">
          <h1 className="text-3xl font-bold text-[#181698]">社区</h1>
          <p className="mb-8">在这里分享你的诊断结果和OOTD！</p>
          <div className="flex flex-col gap-4">
            <input type="file" accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-violet-700 hover:file:bg-violet-100" />
            <textarea placeholder="写下你的分享..." rows={4} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"></textarea>
            <button type="submit" className="rounded-xl bg-[#181698] px-4 py-2 text-white font-semibold shadow-sm hover:bg-[#181698]/90">分享</button>
          </div>
        </div>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}
