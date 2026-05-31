import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AccountProfile {
  nickname: string;
  email: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "users", userId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Partial<AccountProfile>;
  return {
    nickname: typeof data.nickname === "string" ? data.nickname : "",
    email: typeof data.email === "string" ? data.email : "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function saveAccountProfile(userId: string, email: string, nickname: string) {
  if (!db) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  const trimmedNickname = nickname.trim();
  if (!trimmedNickname) {
    throw new Error("NICKNAME_REQUIRED");
  }

  const profileRef = doc(db, "users", userId);
  const snapshot = await getDoc(profileRef);

  await setDoc(
    profileRef,
    {
      nickname: trimmedNickname,
      email,
      updatedAt: serverTimestamp(),
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}
