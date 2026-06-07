"use client";

import { FooterGradient } from "@/components/home/FooterGradient";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  createCommunityPost,
  getCommunityUserName,
  subscribeCommunityPosts,
  type CommunityPost,
} from "@/lib/firestore-community-posts";
import { useAuth } from "@/lib/useAuth";
import { Heart, MessageCircle, Send, Share2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_TAGS = ["穿搭分享", "色彩灵感"];

export default function CommunityPage() {
  const { currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const userEmail = currentUser?.email?.trim() ?? "";
  const userName = useMemo(() => getCommunityUserName(userEmail), [userEmail]);

  useEffect(() => {
    console.log("===调试社区模块开始===");
    console.log("[社区调试] currentUser:", currentUser);
    console.log("[社区调试] auth state:", {
      isAuthenticated,
      authLoading,
      uid: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      providerData: currentUser?.providerData,
    });
  }, [authLoading, currentUser, isAuthenticated]);

  useEffect(() => {
    setLoadingPosts(true);
    setError("");

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeCommunityPosts(
        (nextPosts) => {
          setPosts(nextPosts);
          setLoadingPosts(false);
        },
        () => {
          setError("社区动态加载失败，请稍后重试");
          setLoadingPosts(false);
        },
      );
    } catch {
      setError("社区动态加载失败，请稍后重试");
      setLoadingPosts(false);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const trimmedContent = content.trim();
    if (!isAuthenticated || !currentUser) {
      setError("登录后即可发布社区动态");
      return;
    }
    if (!trimmedContent) {
      setError("内容不能为空");
      return;
    }

    setSubmitting(true);
    try {
      console.log("[社区调试] currentUser:", currentUser);
      console.log("[社区调试] uid:", currentUser?.uid);
      console.log("[社区调试] email:", currentUser?.email);
      console.log("[社区调试] 准备发布动态:", {
        uid: currentUser.uid,
        email: currentUser.email,
        generatedUserName: userName,
        content: trimmedContent,
      });

      await createCommunityPost({
        uid: currentUser.uid,
        userEmail,
        userName,
        content: trimmedContent,
        tags: DEFAULT_TAGS,
      });
      setContent("");
      setNotice("发布成功");
    } catch (error) {
      console.error("[社区调试] 发布动态捕获异常:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("PERMISSION_DENIED") || message.includes("permission-denied")) {
        console.error("[社区调试] 请确认 Firestore rules 允许登录用户读取和创建 community_posts。");
      }
      setError(`发布失败，请稍后重试${message ? `：${message}` : ""}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedRoute>
      <main className="home-dashboard-shell min-h-screen text-[#181698]">
        <Navbar />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-16 lg:pt-10">
          <section className="glass-card-strong rounded-[28px] px-5 py-6 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#81bfe9]/28 bg-white/50 px-3 py-1 text-xs font-semibold text-[#578af4]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  ColorSense Community
                </div>
                <h1 className="mt-4 text-3xl font-bold text-[#181698] sm:text-4xl">美学社区</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[#667694]">分享你的色彩诊断、穿搭灵感与每日 OOTD</p>
              </div>
              <div className="rounded-2xl border border-[#81bfe9]/24 bg-white/54 px-4 py-3 text-sm text-[#667694] shadow-sm">
                {isAuthenticated ? (
                  <p>
                    当前身份：<span className="font-semibold text-[#181698]">{userName}</span>
                  </p>
                ) : (
                  <p>登录后即可发布社区动态</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
            <form onSubmit={handleSubmit} className="glass-card rounded-[28px] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#181698]">发布动态</h2>
                  <p className="mt-2 text-sm leading-6 text-[#667694]">登录后即可发布社区动态</p>
                </div>
                <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#578af4]">实时同步</span>
              </div>

              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={7}
                placeholder="分享今天的穿搭灵感、季型体验或色彩发现..."
                className="mt-5 block w-full resize-none rounded-2xl border border-[#81bfe9]/28 bg-white/72 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-[#8f9bb2] focus:border-[#578af4] focus:ring-4 focus:ring-[#81bfe9]/20"
                disabled={submitting || authLoading}
              />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {DEFAULT_TAGS.map((tag) => (
                  <span key={tag} className="rounded-full border border-[#81bfe9]/24 bg-white/56 px-3 py-1 text-xs font-semibold text-[#667694]">
                    {tag}
                  </span>
                ))}
              </div>

              {error && <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}
              {notice && <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</p>}

              <button
                type="submit"
                disabled={submitting || authLoading || !isAuthenticated}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#181698] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(24,22,152,0.2)] transition hover:bg-[#578af4] disabled:cursor-not-allowed disabled:bg-[#bcc6d7]"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {submitting ? "发布中..." : "发布"}
              </button>
            </form>

            <section className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#181698]">社区动态</h2>
                  <p className="mt-1 text-sm text-[#667694]">所有登录用户都可以查看最新分享</p>
                </div>
                <span className="rounded-full border border-[#81bfe9]/24 bg-white/52 px-3 py-1 text-xs font-semibold text-[#667694]">{posts.length} 条</span>
              </div>

              {loadingPosts && <StateCard text="正在加载社区动态..." />}
              {!loadingPosts && posts.length === 0 && <StateCard text="还没有社区动态，发布第一条色彩灵感吧" />}
              {!loadingPosts && posts.length > 0 && (
                <div className="grid gap-4">
                  {posts.map((post) => (
                    <CommunityPostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </section>
          </section>
        </div>
        <FooterGradient />
      </main>
    </ProtectedRoute>
  );
}

function CommunityPostCard({ post }: { post: CommunityPost }) {
  return (
    <article className="glass-card rounded-[28px] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#578af4,#81bfe9)] text-sm font-bold text-white">
          {post.userName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="max-w-full truncate text-base font-bold text-[#181698]" title={post.userEmail || post.userName}>
              {post.userName}
            </h3>
            {post.seasonType && <span className="rounded-full bg-[#eef6ff] px-2.5 py-1 text-xs font-semibold text-[#578af4]">{post.seasonType}</span>}
          </div>
          <p className="mt-1 text-xs text-[#8f9bb2]">{formatPostTime(post.createdAt)}</p>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{post.content}</p>

      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-[#81bfe9]/20 bg-white/52 px-3 py-1 text-xs font-semibold text-[#667694]">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#81bfe9]/18 pt-4 text-sm text-[#667694]">
        <InteractionButton icon={<Heart className="h-4 w-4" />} label={`点赞 ${post.likeCount}`} />
        <InteractionButton icon={<MessageCircle className="h-4 w-4" />} label={`评论 ${post.commentCount}`} />
        <InteractionButton icon={<Share2 className="h-4 w-4" />} label="分享" />
      </div>
    </article>
  );
}

function InteractionButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-white/48 px-3 font-semibold transition hover:bg-[#eef6ff] hover:text-[#181698]">
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function StateCard({ text }: { text: string }) {
  return <div className="glass-card rounded-[28px] px-5 py-10 text-center text-sm font-medium text-[#667694]">{text}</div>;
}

function formatPostTime(value: string | null) {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
