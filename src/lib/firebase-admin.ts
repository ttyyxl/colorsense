import * as admin from "firebase-admin";
import { HttpsProxyAgent } from "https-proxy-agent";

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  const missing = Object.entries(firebaseAdminConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    console.error("[firebase-admin] Missing service account configuration", {
      missing,
      firebaseProjectIdPresent: Boolean(firebaseAdminConfig.projectId),
      firebaseClientEmailPresent: Boolean(firebaseAdminConfig.clientEmail),
      firebasePrivateKeyPresent: Boolean(firebaseAdminConfig.privateKey),
    });
    throw new Error(`Firebase Admin service account configuration is missing: ${missing.join(", ")}.`);
  }

  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const httpAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseAdminConfig.projectId!,
        clientEmail: firebaseAdminConfig.clientEmail!,
        privateKey: firebaseAdminConfig.privateKey!,
      }),
      ...(httpAgent ? { httpAgent } : {}),
    });
  } catch (error) {
    console.error("[firebase-admin] Initialization failed", {
      firebaseProjectIdPresent: Boolean(firebaseAdminConfig.projectId),
      firebaseClientEmailPresent: Boolean(firebaseAdminConfig.clientEmail),
      firebasePrivateKeyPresent: Boolean(firebaseAdminConfig.privateKey),
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Firebase Admin initialization failed. Check service account environment variables.");
  }
}

export function getFirebaseAdminDebugState() {
  return {
    firebaseProjectIdPresent: Boolean(firebaseAdminConfig.projectId),
    firebaseClientEmailPresent: Boolean(firebaseAdminConfig.clientEmail),
    firebasePrivateKeyPresent: Boolean(firebaseAdminConfig.privateKey),
    httpProxyPresent: Boolean(process.env.HTTP_PROXY),
    httpsProxyPresent: Boolean(process.env.HTTPS_PROXY),
    firebaseAdminInitialized: admin.apps.length > 0,
  };
}

export function getAdminAuth() {
  return initializeFirebaseAdmin().auth();
}

export function getAdminDb() {
  return initializeFirebaseAdmin().firestore();
}
