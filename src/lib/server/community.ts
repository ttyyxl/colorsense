import {
  getCommunityUserName,
  type CommunityComment,
  type CommunityPost,
  type NewCommunityComment,
  type NewCommunityPost,
} from "@/lib/community-types";
import { byId, pgDelete, pgInsert, pgSelect, pgSelectOne } from "./pg";

const POSTS_TABLE = "cs_community_posts";
const LIKES_TABLE = "cs_post_likes";
const COMMENTS_TABLE = "cs_post_comments";

interface PostRow {
  id: string;
  uid: string;
  user_email: string;
  user_name: string;
  content: string;
  season_type: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  uid: string;
  user_email: string;
  user_name: string;
  content: string;
  created_at: string;
}

function countBy(rows: { post_id: string }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }
  return counts;
}

function toPost(row: PostRow, likeCount: number, commentCount: number): CommunityPost {
  return {
    id: row.id,
    uid: typeof row.uid === "string" ? row.uid : "",
    userEmail: typeof row.user_email === "string" ? row.user_email : "",
    userName: row.user_name?.trim() ? row.user_name : getCommunityUserName(row.user_email),
    content: typeof row.content === "string" ? row.content : "",
    seasonType: row.season_type?.trim() ? row.season_type : undefined,
    tags: Array.isArray(row.tags) ? row.tags.filter((item) => typeof item === "string" && Boolean(item.trim())) : undefined,
    likeCount,
    commentCount,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function toComment(row: CommentRow): CommunityComment {
  return {
    id: row.id,
    uid: typeof row.uid === "string" ? row.uid : "",
    userEmail: typeof row.user_email === "string" ? row.user_email : "",
    userName: row.user_name?.trim() ? row.user_name : getCommunityUserName(row.user_email),
    content: typeof row.content === "string" ? row.content : "",
    createdAt: row.created_at ?? null,
  };
}

export async function listCommunityPosts(): Promise<CommunityPost[]> {
  const posts = await pgSelect<PostRow>(POSTS_TABLE, { order: "created_at.desc" });
  if (posts.length === 0) {
    return [];
  }

  const ids = posts.map((post) => post.id);
  const inFilter = `(${ids.join(",")})`;
  const [likes, comments] = await Promise.all([
    pgSelect<{ post_id: string }>(LIKES_TABLE, { select: "post_id", filters: [["post_id", "in", inFilter]] }),
    pgSelect<{ post_id: string }>(COMMENTS_TABLE, { select: "post_id", filters: [["post_id", "in", inFilter]] }),
  ]);

  const likeCounts = countBy(likes);
  const commentCounts = countBy(comments);

  return posts.map((post) => toPost(post, likeCounts.get(post.id) ?? 0, commentCounts.get(post.id) ?? 0));
}

export async function createCommunityPost(input: NewCommunityPost): Promise<string> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("CONTENT_REQUIRED");
  }

  const rows = await pgInsert<{ id: string }>(
    POSTS_TABLE,
    {
      uid: input.uid,
      user_email: input.userEmail,
      user_name: input.userName,
      content,
      ...(input.seasonType ? { season_type: input.seasonType } : {}),
      tags: input.tags ?? [],
    },
    { select: "id" },
  );

  return rows[0]?.id ?? "";
}

export async function getPostLike(postId: string, uid: string): Promise<boolean> {
  const row = await pgSelectOne<{ uid: string }>(LIKES_TABLE, {
    select: "uid",
    filters: [["post_id", "eq", postId], ["uid", "eq", uid]],
  });
  return Boolean(row);
}

export async function togglePostLike(input: { postId: string; uid: string; userEmail: string }): Promise<boolean> {
  const existing = await getPostLike(input.postId, input.uid);

  if (existing) {
    await pgDelete(LIKES_TABLE, [["post_id", "eq", input.postId], ["uid", "eq", input.uid]]);
    return false;
  }

  await pgInsert(LIKES_TABLE, {
    post_id: input.postId,
    uid: input.uid,
    user_email: input.userEmail,
  });
  return true;
}

export async function listPostComments(postId: string): Promise<CommunityComment[]> {
  const rows = await pgSelect<CommentRow>(COMMENTS_TABLE, {
    filters: [["post_id", "eq", postId]],
    order: "created_at.asc",
  });
  return rows.map(toComment);
}

export async function createPostComment(postId: string, input: NewCommunityComment): Promise<string> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("COMMENT_CONTENT_REQUIRED");
  }

  const rows = await pgInsert<{ id: string }>(
    COMMENTS_TABLE,
    {
      post_id: postId,
      uid: input.uid,
      user_email: input.userEmail,
      user_name: input.userName,
      content,
    },
    { select: "id" },
  );

  return rows[0]?.id ?? "";
}

export async function getCommunityPostById(id: string): Promise<CommunityPost | null> {
  const row = await pgSelectOne<PostRow>(POSTS_TABLE, { filters: byId(id) });
  if (!row) {
    return null;
  }
  return toPost(row, 0, 0);
}
