"use client";

import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { getCloudBaseAuth, isCloudBaseConfigured } from "@/lib/cloudbase";
import { getAccountProfile, type AccountProfile } from "@/lib/client/account-profile";
import { signOutUser, toAppUserFromSession, type AppUser } from "@/lib/auth-client";

const DEFAULT_ACCOUNT_LABEL = "\u5df2\u767b\u5f55\u7528\u6237";

export interface AuthContextValue {
  currentUser: AppUser | null;
  accountProfile: AccountProfile | null;
  accountLabel: string;
  loading: boolean;
  isAuthenticated: boolean;
  refreshCurrentUser: () => Promise<AppUser | null>;
  refreshAccountProfile: () => Promise<AccountProfile | null>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function canShowAuthenticatedUi(user: AppUser | null) {
  return Boolean(user?.emailVerified);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authVersion, setAuthVersion] = useState(0);

  const loadAccountProfile = useCallback(async () => {
    try {
      const profile = await getAccountProfile();
      setAccountProfile(profile);
      return profile;
    } catch {
      setAccountProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const auth = getCloudBaseAuth();
    if (!isCloudBaseConfigured() || !auth) {
      setLoading(false);
      return;
    }

    let active = true;

    const applySession = (session: unknown) => {
      const user = toAppUserFromSession(session as never);
      setCurrentUser(user);
      if (!user || !canShowAuthenticatedUi(user)) {
        setAccountProfile(null);
      } else {
        void loadAccountProfile();
      }
      setAuthVersion((version) => version + 1);
      setLoading(false);
    };

    const { data } = auth.onAuthStateChange((_event, session) => {
      if (active) {
        applySession(session);
      }
    });

    void auth
      .getSession()
      .then((result) => {
        if (active && result.data?.session) {
          applySession(result.data.session);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      data?.subscription?.unsubscribe?.();
    };
  }, [loadAccountProfile]);

  const accountLabel =
    accountProfile?.nickname?.trim() || currentUser?.displayName?.trim() || currentUser?.email || DEFAULT_ACCOUNT_LABEL;

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      accountProfile,
      accountLabel,
      loading,
      isAuthenticated: canShowAuthenticatedUi(currentUser),
      refreshCurrentUser: async () => {
        const auth = getCloudBaseAuth();
        if (!auth) {
          setCurrentUser(null);
          setAuthVersion((version) => version + 1);
          return null;
        }

        const result = await auth.getSession();
        const user = toAppUserFromSession(result.data?.session as never);
        setCurrentUser(user);
        setAuthVersion((version) => version + 1);
        return user;
      },
      refreshAccountProfile: async () => {
        const profile = await loadAccountProfile();
        setAuthVersion((version) => version + 1);
        return profile;
      },
      logout: async () => {
        await signOutUser();
        setCurrentUser(null);
        setAccountProfile(null);
        setAuthVersion((version) => version + 1);
      },
    }),
    [accountLabel, accountProfile, authVersion, currentUser, loadAccountProfile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
