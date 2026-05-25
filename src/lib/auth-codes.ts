// Deprecated: Firebase Authentication now sends verification emails directly.
import { createHash, randomInt } from "node:crypto";
import { createSupabaseAdmin } from "./supabase-admin";

export const CODE_EXPIRY_MINUTES = 5;
export const CODE_RESEND_SECONDS = 60;

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashVerificationCode(email: string, code: string) {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

export async function getLatestCode(email: string) {
  const { data, error } = await createSupabaseAdmin()
    .from("email_verification_codes")
    .select("id, code_hash, created_at, expires_at, used")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
