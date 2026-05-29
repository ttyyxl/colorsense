import { getAdminAuth, getFirebaseAdminDebugState } from "./firebase-admin";
import { headers } from "next/headers";

export async function verifyAuth() {
  const authHeader = headers().get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-debug]", {
      authorizationHeaderPresent: Boolean(authHeader),
      tokenPresent: Boolean(token),
      tokenLength: token.length,
      ...getFirebaseAdminDebugState(),
    });
  }

  if (!token) {
    return null;
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auth-debug] verifyIdToken failed", { code, message });
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
