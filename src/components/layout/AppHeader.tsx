"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AppWordmark } from "@/components/layout/AppBranding";
import { useAuth, useCsrfFetch } from "@/hooks/useAuth";

export function AppHeader() {
  const nav = useTranslations("nav");
  const app = useTranslations("app");
  const { user, isAdmin, isAuthenticated, isLoading, refresh } = useAuth();
  const csrfFetch = useCsrfFetch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncOnlineState = () => setIsOnline(window.navigator.onLine);
    syncOnlineState();

    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  const displayName = user
    ? user.nickname || user.name || user.email
    : "";

  const handleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await csrfFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort
    }
    await refresh();
    window.location.href = "/library";
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0b2144]/85 backdrop-blur-md border-b border-white/10">
      <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          aria-label={app("name")}
          className="flex min-w-0 items-center transition-opacity hover:opacity-80"
        >
          <AppWordmark className="block max-w-full truncate" />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label={nav("settings")}
            title={nav("settings")}
            className="group relative flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
          >
            <Image
              src="/images/settings_dark.png"
              alt=""
              width={32}
              height={32}
              aria-hidden="true"
              className="select-none object-contain opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0 group-active:opacity-0"
            />
            <Image
              src="/images/settings_lit.png"
              alt=""
              width={32}
              height={32}
              aria-hidden="true"
              className="absolute inset-0 m-auto select-none object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
            />
          </Link>

          {/* Auth section */}
          {isLoading ? (
            <div className="h-12 w-12 rounded-full bg-white/10 animate-pulse" />
          ) : !isAuthenticated && !isOnline ? (
            <span className="inline-flex h-12 items-center rounded-full bg-amber-100 px-3 text-xs font-semibold text-amber-900">
              Offline Mode
            </span>
          ) : !isAuthenticated ? (
            /* Guest: login icon */
            <button
              onClick={handleLogin}
              aria-label="Sign in with Google"
              title="Sign in with Google"
              className="group relative flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
            >
              <Image
                src="/images/user_login.png"
                alt=""
                width={32}
                height={32}
                aria-hidden="true"
                className="select-none object-contain opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0 group-active:opacity-0"
              />
              <Image
                src="/images/user_login_lit.png"
                alt=""
                width={32}
                height={32}
                aria-hidden="true"
                className="absolute inset-0 m-auto select-none object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
              />
            </button>
          ) : (
            /* Authenticated: avatar + menu */
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex min-h-12 min-w-12 items-center gap-2 rounded-full px-3 py-2 transition-colors hover:bg-white/10"
                aria-label="Account menu"
              >
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:block text-sm text-white/90 max-w-[120px] truncate">
                  {displayName}
                </span>
                {isAdmin && (
                  <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 min-w-[180px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg z-50">
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-sky-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    ⚙️ {nav("settings")}
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin/users"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-sky-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      👥 User Management
                    </Link>
                  )}
                  <button
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-sky-50"
                    onClick={() => void handleLogout()}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}