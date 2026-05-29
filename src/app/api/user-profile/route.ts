import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildUserProfilePromptContext } from "@/lib/user-profile-summary";
import type { UserStyleProfileInput } from "@/lib/user-profile-types";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeProfileInput(payload: unknown): UserStyleProfileInput {
  const root = asRecord(payload);
  const requiredInfo = asRecord(root.requiredInfo);
  const optionalInfo = asRecord(root.optionalInfo);
  const externalFeatures = asRecord(root.externalFeatures);
  const styleTendency = asRecord(root.styleTendency);

  return {
    requiredInfo: {
      gender: asString(requiredInfo.gender),
      genderOther: asString(requiredInfo.genderOther),
      ageRange: asString(requiredInfo.ageRange),
      dailyScene: asString(requiredInfo.dailyScene),
      dailySceneOther: asString(requiredInfo.dailySceneOther),
    },
    optionalInfo: {
      skinTone: asString(optionalInfo.skinTone),
      eyeColor: asString(optionalInfo.eyeColor),
      hairColor: asString(optionalInfo.hairColor),
      stylePreferences: asStringList(optionalInfo.stylePreferences),
      stylePreferenceOther: asString(optionalInfo.stylePreferenceOther),
      makeupPreferences: asStringList(optionalInfo.makeupPreferences),
      makeupPreferenceOther: asString(optionalInfo.makeupPreferenceOther),
    },
    externalFeatures: {
      faceContour: asStringList(externalFeatures.faceContour),
      facialDetails: asStringList(externalFeatures.facialDetails),
      skinHairContrast: asStringList(externalFeatures.skinHairContrast),
    },
    styleTendency: {
      values: asStringList(styleTendency.values),
      other: asString(styleTendency.other),
    },
  };
}

function hasRequiredInfo(profile: UserStyleProfileInput) {
  const { gender, genderOther, ageRange, dailyScene, dailySceneOther } = profile.requiredInfo;
  const hasGender = Boolean(gender && (gender !== "其他" || genderOther));
  const hasDailyScene = Boolean(dailyScene && (dailyScene !== "其他" || dailySceneOther));
  return hasGender && Boolean(ageRange) && hasDailyScene;
}

export async function GET() {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const db = getAdminDb();
  const userRef = db.collection("users").doc(user.uid);
  const profileRef = userRef.collection("profile").doc("questionnaire");

  const [userSnapshot, profileSnapshot] = await Promise.all([userRef.get(), profileRef.get()]);

  return NextResponse.json({
    success: true,
    user: {
      uid: user.uid,
      email: user.email ?? userSnapshot.data()?.email ?? null,
    },
    onboardingCompleted: userSnapshot.data()?.onboardingCompleted === true,
    profile: profileSnapshot.exists ? profileSnapshot.data() : null,
  });
}

export async function PUT(request: Request) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const profileInput = normalizeProfileInput(payload);
  if (!hasRequiredInfo(profileInput)) {
    return NextResponse.json({ success: false, error: "REQUIRED_INFO_MISSING" }, { status: 400 });
  }

  const promptContext = buildUserProfilePromptContext(profileInput);
  const now = new Date();
  const db = getAdminDb();
  const userRef = db.collection("users").doc(user.uid);
  const profileRef = userRef.collection("profile").doc("questionnaire");

  try {
    await db.runTransaction(async (transaction) => {
      const profileSnapshot = await transaction.get(profileRef);
      transaction.set(
        userRef,
        {
          email: user.email ?? null,
          onboardingCompleted: true,
          profileVersion: 2,
          updatedAt: now,
          createdAt: now,
        },
        { merge: true },
      );
      transaction.set(
        profileRef,
        {
          ...profileInput,
          aiPromptReady: true,
          promptContext,
          updatedAt: now,
          createdAt: profileSnapshot.exists ? profileSnapshot.data()?.createdAt ?? now : now,
        },
        { merge: true },
      );
    });
  } catch (error) {
    console.error("[user-profile] save failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    onboardingCompleted: true,
    profileId: "questionnaire",
  });
}
