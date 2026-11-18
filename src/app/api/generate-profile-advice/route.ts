import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { generateProfileAdvice } from "@/lib/ai";
import { getUserProfile, saveGeneratedProfileAdvice } from "@/lib/server/user-profiles";

export const runtime = "nodejs";

export async function POST() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const profile = await getUserProfile(user.uid);

    if (!profile) {
      return NextResponse.json({ success: false, error: "PROFILE_NOT_FOUND" }, { status: 404 });
    }

    if (!profile.promptContext?.summaryText) {
      return NextResponse.json({ success: false, error: "PROMPT_CONTEXT_MISSING" }, { status: 400 });
    }

    console.info("[api/generate-profile-advice] Generating profile advice for user:", user.uid);

    const advice = await generateProfileAdvice(profile.promptContext.summaryText);

    await saveGeneratedProfileAdvice(user.uid, advice);

    return NextResponse.json({
      success: true,
      data: advice,
    });
  } catch (error) {
    console.error("[api/generate-profile-advice] Request failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during profile advice generation." },
      { status: 500 },
    );
  }
}
