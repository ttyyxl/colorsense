import { adminAuth } from "./firebase-admin";
import { headers } from "next/headers";

export async function verifyAuth() {
  const authHeader = headers().get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return null;
  }
}

export async function requireAuth() {
  const user = await verifyAuth();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
