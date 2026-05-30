import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { generateProfileAdvice } from "@/lib/ai";
import { UserStyleProfile } from "@/lib/user-profile-types"; // Import UserStyleProfile type

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const db = getAdminDb();
  const profileRef = db.collection("users").doc(user.uid).collection("profile").doc("questionnaire");

  try {
    const profileSnapshot = await profileRef.get();

    if (!profileSnapshot.exists) {
      return NextResponse.json({ success: false, error: "PROFILE_NOT_FOUND" }, { status: 404 });
    }

    const profile = profileSnapshot.data() as UserStyleProfile;

    if (!profile.promptContext?.summaryText) {
      return NextResponse.json({ success: false, error: "PROMPT_CONTEXT_MISSING" }, { status: 400 });
    }

    console.info("[api/generate-profile-advice] Generating profile advice for user:", user.uid);

    const advice = await generateProfileAdvice(profile.promptContext.summaryText);

    // Save the generated advice back to the user's profile
    await profileRef.set(
      {
        generatedProfileAdvice: advice, // Store the AI generated advice
        updatedAt: new Date(),
      },
      { merge: true },
    );

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