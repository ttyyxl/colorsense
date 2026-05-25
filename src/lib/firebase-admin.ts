import * as admin from "firebase-admin";

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    if (firebaseAdminConfig.clientEmail && firebaseAdminConfig.privateKey) {
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebaseAdminConfig.projectId,
          clientEmail: firebaseAdminConfig.clientEmail,
          privateKey: firebaseAdminConfig.privateKey,
        }),
      });
    } else {
      // Fallback for environments where default credentials are available (e.g., Google Cloud)
      return admin.initializeApp();
    }
  }
  return admin.app();
}

export const adminAuth = initializeFirebaseAdmin().auth();
export const adminDb = initializeFirebaseAdmin().firestore();
