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

  // Read-only account info
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountGoogleName, setAccountGoogleName] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
          setAccountEmail(data.profile.email ?? null);
          setAccountGoogleName(data.profile.name ?? null);
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
      setShowDeleteModal(false);
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

            {/* Read-only Google account identity — shown to all logged-in users */}
            <div className="flex flex-col gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Google Account (read-only)
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">Google Username</label>
                <input
                  type="text"
                  className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                  value={accountGoogleName ?? ""}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">Google Email</label>
                <input
                  type="text"
                  className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                  value={accountEmail ?? ""}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>

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

      {/* Delete account */}
      <section className="rounded-2xl border-2 border-gray-100 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">⚠️ Account</h2>
        <p className="mb-3 text-sm text-gray-600">
          Deleting your account signs you out immediately, and you can&apos;t access the system anymore.
        </p>
        {accountError && <p className="mb-3 text-sm text-orange-600">{accountError}</p>}
        <button
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors
            bg-red-500 hover:bg-red-600
            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setShowDeleteModal(true)}
        >
          🗑️ Delete Account
        </button>
      </section>

      {/* Delete account confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => { if (!deleteBusy) setShowDeleteModal(false); }}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Delete Account?</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                This action is <span className="font-semibold text-red-600">permanent and irreversible</span>.
                Once your account is deleted, you will be signed out immediately and will
                <span className="font-semibold"> no longer be able to log in</span> to this system.
              </p>
            </div>
            {accountError && <p className="text-center text-sm text-red-600">{accountError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700
                  hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1
                  disabled:opacity-50"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white
                  bg-red-500 hover:bg-red-600
                  focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
                  disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteBusy}
              >
                {deleteBusy ? "Deleting..." : "Yes, Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
