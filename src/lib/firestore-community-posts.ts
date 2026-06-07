import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CommunityPost {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  content: string;
  seasonType?: string;
  tags?: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface NewCommunityPost {
  uid: string;
  userEmail: string;
  userName: string;
  content: string;
  seasonType?: string;
  tags?: string[];
}

const COLLECTION_NAME = "community_posts";

function logPermissionHint(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("PERMISSION_DENIED") || message.includes("permission-denied")) {
    console.error("[社区调试] Firestore 权限被拒绝，请确认 rules 允许：登录用户创建动态、登录用户读取动态。");
  }
}

function getCommunityPostsCollection() {
  if (!db) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }
  return collection(db, COLLECTION_NAME);
}

export function getCommunityUserName(email: string | null | undefined) {
  const trimmedEmail = email?.trim();
  if (!trimmedEmail) {
    return "ColorSense 用户";
  }

  const prefix = trimmedEmail.split("@")[0]?.trim();
  return prefix || "ColorSense 用户";
}

function timestampToIso(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const timestamp = value as { toDate?: () => Date };
    return timestamp.toDate?.().toISOString() ?? null;
  }

  return null;
}

function readCommunityPost(snapshot: QueryDocumentSnapshot): CommunityPost {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    uid: typeof data.uid === "string" ? data.uid : "",
    userEmail: typeof data.userEmail === "string" ? data.userEmail : "",
    userName: typeof data.userName === "string" && data.userName.trim() ? data.userName : getCommunityUserName(data.userEmail as string | undefined),
    content: typeof data.content === "string" ? data.content : "",
    seasonType: typeof data.seasonType === "string" && data.seasonType.trim() ? data.seasonType : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : undefined,
    likeCount: typeof data.likeCount === "number" ? data.likeCount : 0,
    commentCount: typeof data.commentCount === "number" ? data.commentCount : 0,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function createCommunityPost(input: NewCommunityPost) {
  const content = input.content.trim();
  if (!content) {
    throw new Error("CONTENT_REQUIRED");
  }

  console.log("[社区调试] addDoc 前待发布内容:", {
    uid: input.uid,
    userEmail: input.userEmail,
    userName: input.userName,
    content,
    seasonType: input.seasonType,
    tags: input.tags,
    db,
  });

  try {
    const ref = await addDoc(getCommunityPostsCollection(), {
      uid: input.uid,
      userEmail: input.userEmail,
      userName: input.userName,
      content,
      ...(input.seasonType ? { seasonType: input.seasonType } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log("[社区调试] 发布成功，文档 ID:", ref.id);
    return ref.id;
  } catch (error) {
    console.error("[社区调试] 发布失败完整错误对象:", error);
    logPermissionHint(error);
    throw error;
  }
}

export function subscribeCommunityPosts(
  onNext: (posts: CommunityPost[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  console.log("[社区调试] Firestore db instance:", db);

  const postsQuery = query(getCommunityPostsCollection(), orderBy("createdAt", "desc"));

  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts = snapshot.docs.map(readCommunityPost);
      console.log("[社区调试] onSnapshot 成功:", {
        count: posts.length,
        preview: posts.slice(0, 3).map((post) => ({
          id: post.id,
          uid: post.uid,
          userEmail: post.userEmail,
          userName: post.userName,
          content: post.content.slice(0, 40),
          createdAt: post.createdAt,
        })),
      });
      onNext(posts);
    },
    (error) => {
      console.error("[社区调试] onSnapshot 失败完整错误对象:", error);
      logPermissionHint(error);
      onError(error);
    },
  );
}
