"use client";

import { createContext, ReactNode, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { getAccountProfile, type AccountProfile } from "@/lib/firestore-account-profile";

const DEFAULT_ACCOUNT_LABEL = "\u5df2\u767b\u5f55\u7528\u6237";

export interface AuthContextValue {
  currentUser: User | null;
  accountProfile: AccountProfile | null;
  accountLabel: string;
  loading: boolean;
  isAuthenticated: boolean;
  refreshCurrentUser: () => Promise<User | null>;
  refreshAccountProfile: () => Promise<AccountProfile | null>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function canShowAuthenticatedUi(user: User | null) {
  if (!user) {
    return false;
  }
  return user.emailVerified || user.providerData.some((provider) => provider.providerId === "google.com");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user || !canShowAuthenticatedUi(user)) {
        setAccountProfile(null);
      } else {
        void getAccountProfile(user.uid)
          .then((profile) => setAccountProfile(profile))
          .catch(() => setAccountProfile(null));
      }
      setAuthVersion((version) => version + 1);
      setLoading(false);
    });
  }, []);

  const accountLabel = accountProfile?.nickname?.trim() || currentUser?.displayName?.trim() || currentUser?.email || DEFAULT_ACCOUNT_LABEL;

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      accountProfile,
      accountLabel,
      loading,
      isAuthenticated: canShowAuthenticatedUi(currentUser),
      refreshCurrentUser: async () => {
        if (!auth?.currentUser) {
          setCurrentUser(null);
          setAuthVersion((version) => version + 1);
          return null;
        }

        await auth.currentUser.reload();
        const reloadedUser = auth.currentUser;
        setCurrentUser(reloadedUser);
        setAuthVersion((version) => version + 1);
        return reloadedUser;
      },
      refreshAccountProfile: async () => {
        if (!auth?.currentUser) {
          setAccountProfile(null);
          return null;
        }

        const profile = await getAccountProfile(auth.currentUser.uid);
        setAccountProfile(profile);
        setAuthVersion((version) => version + 1);
        return profile;
      },
      logout: async () => {
        if (auth) {
          await signOut(auth);
        }
      },
    }),
    [accountLabel, accountProfile, authVersion, currentUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
