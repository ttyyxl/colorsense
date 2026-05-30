import { getAdminDb } from "./firebase-admin";
import { UserStyleProfile } from "./user-profile-types";

export async function getUserProfile(userId: string): Promise<UserStyleProfile | null> {
  const db = getAdminDb();
  const profileRef = db.collection("users").doc(userId).collection("profile").doc("questionnaire");
  const profileSnapshot = await profileRef.get();

  if (!profileSnapshot.exists) {
    return null;
  }

  return profileSnapshot.data() as UserStyleProfile;
}
