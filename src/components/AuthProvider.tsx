"use client";

import { createContext, ReactNode, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

export interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      loading,
      isAuthenticated: Boolean(currentUser),
      logout: async () => {
        if (auth) {
          await signOut(auth);
        }
      },
    }),
    [currentUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
