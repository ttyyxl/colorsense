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

export interface CommunityComment {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  content: string;
  createdAt: string | null;
}

export interface NewCommunityComment {
  uid: string;
  userEmail: string;
  userName: string;
  content: string;
}

export function getCommunityUserName(email: string | null | undefined) {
  const trimmedEmail = email?.trim();
  if (!trimmedEmail) {
    return "ColorSense 用户";
  }

  const prefix = trimmedEmail.split("@")[0]?.trim();
  return prefix || "ColorSense 用户";
}
