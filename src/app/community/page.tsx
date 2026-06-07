"use client";

import { FooterGradient } from "@/components/home/FooterGradient";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  createCommunityPost,
  createCommunityPostComment,
  getCommunityUserName,
  subscribeCommunityPosts,
  subscribePostComments,
  subscribePostLike,
  toggleCommunityPostLike,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/firestore-community-posts";
import { useAuth } from "@/lib/useAuth";
import { Heart, MessageCircle, Plus, Send, Share2, Sparkles } from "lucide-react";
import type { User } from "firebase/auth";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const HOT_TAGS = [
  "今日OOTD",
  "穿搭分享",
  "季型诊断",
  "色彩灵感",
  "妆容建议",
  "通勤穿搭",
  "校园穿搭",
  "旅行穿搭",
  "约会穿搭",
  "显白配色",
  "冷暖色调",
  "春夏秋冬",
  "购物参考",
  "风格记录",
];

const MAX_TAGS = 5;

export default function CommunityPage() {
  const { currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

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
        tags: selectedTags,
      });
      setContent("");
      setSelectedTags([]);
      setCustomTag("");
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

  function toggleTag(tag: string) {
    setNotice("");
    setError("");
    setSelectedTags((currentTags) => {
      if (currentTags.includes(tag)) {
        return currentTags.filter((item) => item !== tag);
      }
      if (currentTags.length >= MAX_TAGS) {
        setError("最多选择 5 个标签");
        return currentTags;
      }
      return [...currentTags, tag];
    });
  }

  function addCustomTag() {
    setNotice("");
    setError("");
    const tag = customTag.trim().replace(/^#/, "");
    if (!tag) {
      return;
    }
    if (tag.length > 24) {
      setError("自定义标签长度不能超过 24 个字符");
      return;
    }
    if (selectedTags.includes(tag)) {
      setCustomTag("");
      return;
    }
    if (selectedTags.length >= MAX_TAGS) {
      setError("最多选择 5 个标签");
      return;
    }
    setSelectedTags((currentTags) => [...currentTags, tag]);
    setCustomTag("");
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

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#181698]">动态标签</p>
                  <p className="text-xs font-medium text-[#8f9bb2]">{selectedTags.length}/{MAX_TAGS}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HOT_TAGS.map((tag) => {
                    const selected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? "border-[#578af4] bg-[#181698] text-white shadow-[0_10px_22px_rgba(24,22,152,0.18)]"
                            : "border-[#81bfe9]/24 bg-white/56 text-[#667694] hover:bg-[#eef6ff] hover:text-[#181698]"
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={customTag}
                    onChange={(event) => setCustomTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="添加自定义标签"
                    className="min-w-0 flex-1 rounded-2xl border border-[#81bfe9]/28 bg-white/72 px-4 py-2 text-sm text-slate-800 outline-none transition placeholder:text-[#8f9bb2] focus:border-[#578af4] focus:ring-4 focus:ring-[#81bfe9]/20"
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    className="inline-flex min-h-10 items-center justify-center gap-1 rounded-2xl border border-[#81bfe9]/28 bg-white/64 px-4 text-sm font-semibold text-[#181698] hover:bg-[#eef6ff]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    添加
                  </button>
                </div>
              </div>

              {selectedTags.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="rounded-full border border-[#81bfe9]/24 bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#181698] hover:bg-white"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              {selectedTags.length === 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {["今日OOTD", "穿搭分享"].map((tag) => (
                    <span key={tag} className="rounded-full border border-[#81bfe9]/24 bg-white/56 px-3 py-1 text-xs font-semibold text-[#667694]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

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
                    <CommunityPostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      isAuthenticated={isAuthenticated}
                      userName={userName}
                      onError={setError}
                      onNotice={setNotice}
                    />
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

function CommunityPostCard({
  post,
  currentUser,
  isAuthenticated,
  userName,
  onError,
  onNotice,
}: {
  post: CommunityPost;
  currentUser: User | null;
  isAuthenticated: boolean;
  userName: string;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setLiked(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribePostLike(
        post.id,
        currentUser.uid,
        (nextLiked) => setLiked(nextLiked),
        () => onError("点赞状态加载失败，请稍后重试"),
      );
    } catch {
      onError("点赞状态加载失败，请稍后重试");
    }

    return () => {
      unsubscribe?.();
    };
  }, [currentUser, onError, post.id]);

  useEffect(() => {
    if (!commentsOpen) {
      return;
    }

    setCommentsLoading(true);
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribePostComments(
        post.id,
        (nextComments) => {
          setComments(nextComments);
          setCommentsLoading(false);
        },
        () => {
          onError("评论加载失败，请稍后重试");
          setCommentsLoading(false);
        },
      );
    } catch {
      onError("评论加载失败，请稍后重试");
      setCommentsLoading(false);
    }

    return () => {
      unsubscribe?.();
    };
  }, [commentsOpen, onError, post.id]);

  async function handleLike() {
    onError("");
    onNotice("");
    if (!isAuthenticated || !currentUser) {
      onError("登录后即可点赞");
      return;
    }

    setLikeLoading(true);
    try {
      await toggleCommunityPostLike({
        postId: post.id,
        uid: currentUser.uid,
        userEmail: currentUser.email ?? "",
      });
    } catch (error) {
      console.error("[社区调试] 点赞操作失败完整错误:", error);
      const message = error instanceof Error ? error.message : String(error);
      onError(`点赞失败，请稍后重试${message ? `：${message}` : ""}`);
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleCommentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    onNotice("");
    if (!isAuthenticated || !currentUser) {
      onError("登录后即可评论");
      return;
    }

    const trimmedContent = commentContent.trim();
    if (!trimmedContent) {
      return;
    }

    setCommentSubmitting(true);
    try {
      await createCommunityPostComment(post.id, {
        uid: currentUser.uid,
        userEmail: currentUser.email ?? "",
        userName,
        content: trimmedContent,
      });
      setCommentContent("");
    } catch (error) {
      console.error("[社区调试] 评论发送失败完整错误:", error);
      const message = error instanceof Error ? error.message : String(error);
      onError(`评论发送失败，请稍后重试${message ? `：${message}` : ""}`);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleShare() {
    onError("");
    onNotice("");
    const shareUrl = `${window.location.origin}/community?post=${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "ColorSense 美学社区",
          text: "分享一条来自 ColorSense 美学社区的动态",
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      onNotice("链接已复制，可以分享给朋友了");
    } catch (error) {
      console.error("[社区调试] 分享失败完整错误:", error);
      const message = error instanceof Error ? error.message : String(error);
      onError(`分享失败，请稍后重试${message ? `：${message}` : ""}`);
    }
  }

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
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#81bfe9]/18 pt-4 text-sm text-[#667694] sm:flex">
        <InteractionButton
          active={liked}
          disabled={likeLoading}
          icon={<Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />}
          label={`${liked ? "❤️" : "♡"} ${post.likeCount}`}
          onClick={handleLike}
        />
        <InteractionButton
          active={commentsOpen}
          icon={<MessageCircle className="h-4 w-4" />}
          label={`评论 ${post.commentCount}`}
          onClick={() => {
            if (!isAuthenticated || !currentUser) {
              onError("登录后即可评论");
              return;
            }
            setCommentsOpen((value) => !value);
          }}
        />
        <InteractionButton icon={<Share2 className="h-4 w-4" />} label="分享" onClick={handleShare} />
      </div>

      {commentsOpen && (
        <div className="mt-4 rounded-3xl border border-[#81bfe9]/18 bg-white/42 p-4">
          <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={commentContent}
              onChange={(event) => setCommentContent(event.target.value)}
              placeholder="写下你的评论..."
              className="min-w-0 flex-1 rounded-2xl border border-[#81bfe9]/24 bg-white/72 px-4 py-2 text-sm text-slate-800 outline-none transition placeholder:text-[#8f9bb2] focus:border-[#578af4] focus:ring-4 focus:ring-[#81bfe9]/20"
              disabled={commentSubmitting}
            />
            <button
              type="submit"
              disabled={commentSubmitting || !commentContent.trim()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-[#181698] px-4 text-sm font-semibold text-white transition hover:bg-[#578af4] disabled:cursor-not-allowed disabled:bg-[#bcc6d7]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              发送
            </button>
          </form>

          <div className="mt-4 grid gap-3">
            {commentsLoading && <p className="text-sm text-[#8f9bb2]">正在加载评论...</p>}
            {!commentsLoading && comments.length === 0 && <p className="text-sm text-[#8f9bb2]">还没有评论，来写第一条吧</p>}
            {!commentsLoading &&
              comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-white/58 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#8f9bb2]">
                    <span className="font-semibold text-[#181698]">{comment.userName}</span>
                    <span>{formatPostTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{comment.content}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </article>
  );
}

function InteractionButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "bg-rose-50 text-rose-600" : "bg-white/48 text-[#667694] hover:bg-[#eef6ff] hover:text-[#181698]"
      }`}
    >
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
