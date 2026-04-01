"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth, useCsrfFetch } from "@/hooks/useAuth";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading, refresh } = useAuth();
  const csrfFetch = useCsrfFetch();

  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/library");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const loadProfile = async () => {
      try {
        const response = await fetch("/api/account/profile");
        if (!response.ok) throw new Error("Failed to load profile");
        const data = await response.json();
        if (!cancelled && data.profile) {
          setNickname(data.profile.nickname ?? "");
          setAvatarUrl(data.profile.avatarUrl ?? "");
          setPersonalNote(data.profile.personalNote ?? "");
        }
      } catch {
        if (!cancelled) setProfileError("Failed to load profile");
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const response = await csrfFetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, avatarUrl, personalNote }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }

      await refresh();
      setProfileMessage("Profile saved.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteBusy(true);
    setAccountError(null);

    try {
      const response = await csrfFetch("/api/auth/account", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete account");
      }
      await refresh();
      window.location.href = "/library";
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Failed to delete account");
      setDeleteBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-bounce">🦉</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-8 py-8 px-4">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold" style={{ color: "var(--color-warm-orange)" }}>
          👤 My Profile
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              ⭐ Admin
            </span>
          )}
        </h1>
      </div>

      {/* Profile card */}
      <section className="rounded-2xl border-2 border-gray-100 bg-white p-6">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Form fields */}
          <div className="flex flex-1 flex-col gap-4">
          {/* Admin badge — also shown inline in the h1, remove standalone version */}

            <div>
              <label className="mb-1 block text-sm font-medium">Nickname</label>
              <input
                type="text"
                className="w-full max-w-xs rounded-xl border-2 border-gray-200 px-3 py-2 text-sm"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={100}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Avatar URL</label>
              <input
                type="url"
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="mt-1 text-xs text-gray-400">
                Paste an HTTPS image URL. Preview updates in real time.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Personal Note</label>
              <textarea
                className="w-full resize-y rounded-xl border-2 border-gray-200 px-3 py-2 text-sm"
                rows={4}
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                maxLength={5000}
              />
              <p className="mt-1 text-xs text-gray-400">{personalNote.length}/5000</p>
            </div>

            {profileError && <p className="text-sm text-orange-600">{profileError}</p>}
            {profileMessage && <p className="text-sm text-green-700">{profileMessage}</p>}

            <Button
              variant="secondary"
              onClick={() => void handleSaveProfile()}
              disabled={profileSaving}
            >
              {profileSaving ? "Saving..." : "Save Profile"}
            </Button>
          </div>

          {/* Avatar preview — right side */}
          <div className="flex shrink-0 flex-col items-center gap-3 md:w-40">
            <p className="text-sm font-medium text-gray-500">Avatar Preview</p>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar preview"
                className="h-28 w-28 rounded-full border-4 border-sky-100 object-cover shadow"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="h-28 w-28 items-center justify-center rounded-full border-4 border-sky-100 bg-sky-50 text-4xl text-sky-300 shadow"
              style={{ display: avatarUrl ? "none" : "flex" }}
              aria-hidden="true"
            >
              👤
            </div>
            {avatarUrl && (
              <p className="text-center text-xs text-gray-400">Live preview</p>
            )}
          </div>
        </div>
      </section>

      {/* Delete account — only for non-admin users */}
      {!isAdmin && (
        <section className="rounded-2xl border-2 border-gray-100 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold">⚠️ Account</h2>
          <p className="mb-3 text-sm text-gray-600">
            Deleting your account signs you out immediately, and you can't access the system anymore.
          </p>
          {accountError && <p className="mb-3 text-sm text-orange-600">{accountError}</p>}
          {!showDeleteConfirm ? (
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)}>
              Delete My Account
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-orange-600">Are you sure?</span>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <button
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteBusy}
              >
                {deleteBusy ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
