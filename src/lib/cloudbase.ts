"use client";

import cloudbase from "@cloudbase/js-sdk";

export type CloudBaseApp = ReturnType<typeof cloudbase.init>;
export type CloudBaseAuth = ReturnType<CloudBaseApp["auth"]>;

const envId = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
const publishableKey = process.env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY;
const region = process.env.NEXT_PUBLIC_CLOUDBASE_REGION || "ap-shanghai";

export function isCloudBaseConfigured() {
  return Boolean(envId && publishableKey);
}

let app: CloudBaseApp | null = null;

export function getCloudBaseApp(): CloudBaseApp | null {
  if (!envId || !publishableKey) {
    return null;
  }

  if (!app) {
    app = cloudbase.init({
      env: envId,
      region,
      accessKey: publishableKey,
      persistence: "local",
    });
  }

  return app;
}

export function getCloudBaseAuth(): CloudBaseAuth | null {
  const instance = getCloudBaseApp();
  return instance ? instance.auth() : null;
}
