"use client";

import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FooterGradient } from "@/components/home/FooterGradient";
import { useState, useRef } from "react";

export default function CommunityPage() {
  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [postedTime, setPostedTime] = useState<string | null>(null);
  const [isPosted, setIsPosted] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPostImage(null);
    }
  };

  const handleShare = () => {
    if (postText.trim() || postImage) {
      setIsPosted(true);
      setPostedTime(new Date().toLocaleString());
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000); // Hide message after 3 seconds
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen text-[#181698]">
        <Navbar />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-18 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:gap-20 md:pb-20 lg:pt-8">
          <h1 className="text-3xl font-bold text-[#181698]">社区</h1>

          {showSuccessMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">成功!</strong>
              <span className="block sm:inline"> 你的内容已成功发布。</span>
            </div>
          )}

          {!isPosted ? (
            <div className="flex flex-col gap-4">
              <p className="mb-2">在这里分享你的诊断结果和OOTD！</p>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-violet-700 hover:file:bg-violet-100"
              />
              {postImage && (
                <div className="mt-4">
                  <img src={postImage} alt="预览" className="max-w-xs h-auto rounded-md" />
                </div>
              )}
              <textarea
                placeholder="写下你的分享..."
                rows={4}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              ></textarea>
              <button
                type="submit"
                onClick={handleShare}
                className="rounded-xl bg-[#181698] px-4 py-2 text-white font-semibold shadow-sm hover:bg-[#181698]/90"
              >
                分享
              </button>
            </div>
          ) : (
            <div className="bg-white shadow-md rounded-lg p-6 mt-8">
              {postImage && (
                <img src={postImage} alt="分享图片" className="max-w-full h-auto rounded-md mb-4" />
              )}
              <p className="text-gray-800 text-lg mb-2">{postText}</p>
              {postedTime && (
                <p className="text-gray-500 text-sm">发布于: {postedTime}</p>
              )}
            </div>
          )}
        </div>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}
