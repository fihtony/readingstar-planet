"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { PublicUser } from "@/types";

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  csrfToken: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isAuthenticated: false,
  refresh: async () => {},
  csrfToken: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCsrf = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/csrf");
      if (res.ok) {
        const data = await res.json();
        setCsrfToken(data.csrfToken ?? null);
      }
    } catch {
      // CSRF fetch failure is non-fatal for read-only guests
    }
  }, []);

  useEffect(() => {
    void fetchUser();
    void fetchCsrf();
  }, [fetchUser, fetchCsrf]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchUser();
    await fetchCsrf();
  }, [fetchUser, fetchCsrf]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAdmin: user?.role === "admin",
    isAuthenticated: user !== null,
    refresh,
    csrfToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Get fetch options with CSRF token for state-changing requests.
 */
export function useCsrfFetch() {
  const { csrfToken } = useAuth();

  return useCallback(
    (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      if (csrfToken) {
        headers.set("x-csrf-token", csrfToken);
      }
      return fetch(url, { ...options, headers });
    },
    [csrfToken]
  );
}
