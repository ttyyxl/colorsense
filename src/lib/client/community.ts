"use client";

import { apiJson, apiFetch, postJson } from "./api";
import {
  getCommunityUserName,
  type CommunityComment,
  type CommunityPost,
  type NewCommunityComment,
  type NewCommunityPost,
} from "@/lib/community-types";

export { getCommunityUserName };
export type { CommunityComment, CommunityPost, NewCommunityComment, NewCommunityPost };

type Unsubscribe = () => void;

const POLL_INTERVAL_MS = 15_000;

/** 轮询替代 Firestore 的实时订阅：立即拉取一次，之后按固定间隔刷新。 */
function poll<T>(fetcher: () => Promise<T>, onNext: (value: T) => void, onError: (error: Error) => void): Unsubscribe {
  let active = true;
  let timer: ReturnType<typeof setInterval> | undefined;

  const run = async () => {
    try {
      const value = await fetcher();
      if (active) {
        onNext(value);
      }
    } catch (error) {
      if (active) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  void run();
  timer = setInterval(() => void run(), POLL_INTERVAL_MS);

  return () => {
    active = false;
    if (timer) {
      clearInterval(timer);
    }
  };
}

export async function fetchCommunityPosts(): Promise<CommunityPost[]> {
  const payload = await apiJson<{ success?: boolean; posts?: CommunityPost[] }>("/api/community/posts");
  return payload.posts ?? [];
}

export function subscribeCommunityPosts(
  onNext: (posts: CommunityPost[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return poll(fetchCommunityPosts, onNext, onError);
}

export async function createCommunityPost(input: NewCommunityPost): Promise<string> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("CONTENT_REQUIRED");
  }

  const payload = await postJson<{ success?: boolean; id?: string }>("/api/community/posts", {
    userName: input.userName,
    content,
    ...(input.seasonType ? { seasonType: input.seasonType } : {}),
    tags: input.tags ?? [],
  });

  return payload.id ?? "";
}

export async function fetchPostLike(postId: string): Promise<boolean> {
  const payload = await apiJson<{ success?: boolean; liked?: boolean }>(
    `/api/community/posts/${encodeURIComponent(postId)}/likes`,
  );
  return Boolean(payload.liked);
}

export function subscribePostLike(
  postId: string,
  _uid: string,
  onNext: (liked: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return poll(() => fetchPostLike(postId), onNext, onError);
}

export async function toggleCommunityPostLike(input: {
  postId: string;
  uid: string;
  userEmail: string;
}): Promise<boolean> {
  const payload = await postJson<{ success?: boolean; liked?: boolean }>(
    `/api/community/posts/${encodeURIComponent(input.postId)}/likes`,
    {},
  );
  return Boolean(payload.liked);
}

export async function fetchPostComments(postId: string): Promise<CommunityComment[]> {
  const response = await apiFetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`);
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; comments?: CommunityComment[] }
    | null;
  if (!response.ok) {
    throw new Error(payload && "error" in (payload as object) ? String((payload as { error?: unknown }).error) : "加载评论失败。");
  }
  return payload?.comments ?? [];
}

export function subscribePostComments(
  postId: string,
  onNext: (comments: CommunityComment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return poll(() => fetchPostComments(postId), onNext, onError);
}

export async function createCommunityPostComment(postId: string, input: NewCommunityComment): Promise<string> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("COMMENT_CONTENT_REQUIRED");
  }

  const payload = await postJson<{ success?: boolean; id?: string }>(
    `/api/community/posts/${encodeURIComponent(postId)}/comments`,
    {
      userName: input.userName,
      content,
    },
  );

  return payload.id ?? "";
}
