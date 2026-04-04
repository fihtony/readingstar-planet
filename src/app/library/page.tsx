"use client";

import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DocumentUpload, type ImportParams } from "@/components/upload/DocumentUpload";
import { MascotGuide } from "@/components/mascot/MascotGuide";
import { Button } from "@/components/ui/Button";
import { getRecommendedReadMinutes, getWordCount, markReadCounted } from "@/lib/read-count";
import { useAuth, useCsrfFetch } from "@/hooks/useAuth";
import type { Document, DocumentGroup, UserReadingStats } from "@/types";

type SortBy = "name" | "size" | "mostRead" | "latestUpdate" | "myRead";
type SortDir = "asc" | "desc";

const DEFAULT_SORT_DIR: Record<SortBy, SortDir> = {
  name: "asc",
  size: "asc",
  mostRead: "desc",
  latestUpdate: "desc",
  myRead: "desc",
};

export default function LibraryPage() {
  const t = useTranslations("library");
  const mascot = useTranslations("mascot");
  const { isAdmin, isAuthenticated } = useAuth();
  const csrfFetch = useCsrfFetch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [userStats, setUserStats] = useState<Record<string, UserReadingStats>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [draggingDocumentId, setDraggingDocumentId] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);

  // Group rename
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  // Document editing
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editDocTitle, setEditDocTitle] = useState("");
  const [editDocContent, setEditDocContent] = useState("");
  const [editDocIcon, setEditDocIcon] = useState("");
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<SortBy>("mostRead");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Delete confirmation
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingDocTitle, setDeletingDocTitle] = useState("");

  // Delete group confirmation
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deletingGroupName, setDeletingGroupName] = useState("");

  // Invite-only dialog
  const [showInviteOnlyDialog, setShowInviteOnlyDialog] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Detect invite_only redirect from Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "invite_only") {
      setShowInviteOnlyDialog(true);
      // Clean up URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        setGroups(data.groups ?? []);
        if (data.userStats) {
          const statsMap: Record<string, UserReadingStats> = {};
          for (const [docId, stats] of Object.entries(data.userStats)) {
            statsMap[docId] = stats as UserReadingStats;
          }
          setUserStats(statsMap);
        }
      }
    } catch {
      // Silently handle — empty state is fine for first load
    }
  };

  const handleImport = async ({ title, content, groupId }: ImportParams) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const res = await csrfFetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, groupId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Something went wrong");
        return;
      }

      setUploadSuccess(true);
      await fetchDocuments();
      setTimeout(() => {
        setUploadSuccess(false);
        setShowUpload(false);
      }, 2000);
    } catch {
      setUploadError("Something went wrong. Let's try again!");
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDelete = (id: string, title: string) => {
    setDeletingDocId(id);
    setDeletingDocTitle(title);
  };

  const handleDelete = async () => {
    if (!deletingDocId) return;
    const id = deletingDocId;
    setDeletingDocId(null);
    try {
      const res = await csrfFetch(`/api/documents?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // Handle error silently
    }
  };

  const handleRequestAccess = async () => {
    setRequestBusy(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: requestEmail, message: requestMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequestError(data.error || "Failed to send request. Please try again.");
        return;
      }
      setRequestSent(true);
    } catch {
      setRequestError("Network error. Please try again.");
    } finally {
      setRequestBusy(false);
    }
  };

  const handleCreateGroup = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      return;
    }

    const res = await csrfFetch("/api/document-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName }),
    });

    if (res.ok) {
      setGroupName("");
      setShowGroupForm(false);
      await fetchDocuments();
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    const trimmed = editingGroupName.trim();
    if (!trimmed) return;
    const res = await csrfFetch("/api/document-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", groupId, name: trimmed }),
    });
    if (res.ok) {
      setEditingGroupId(null);
      setEditingGroupName("");
      await fetchDocuments();
    }
  };

  const openEditGroup = (group: DocumentGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  const confirmDeleteGroup = (group: DocumentGroup) => {
    setDeletingGroupId(group.id);
    setDeletingGroupName(group.name);
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroupId) return;
    const id = deletingGroupId;
    setDeletingGroupId(null);
    try {
      const res = await csrfFetch(`/api/document-groups?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch {
      // Handle error silently
    }
  };

  const handleUpdateDoc = async () => {
    if (!editingDoc) return;
    setIsSavingDoc(true);
    try {
      const res = await csrfFetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-document",
          documentId: editingDoc.id,
          title: editDocTitle.trim(),
          content: editDocContent,
          icon: editDocIcon.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingDoc(null);
        await fetchDocuments();
      }
    } finally {
      setIsSavingDoc(false);
    }
  };

  const openEditDoc = (doc: Document) => {
    setEditingDoc(doc);
    setEditDocTitle(doc.title);
    setEditDocContent(doc.content);
    setEditDocIcon(doc.icon ?? "");
  };

  const handleSortChange = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(DEFAULT_SORT_DIR[field]);
    }
  };

  const sortDocuments = (docs: Document[]): Document[] => {
    return [...docs].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.title.localeCompare(b.title);
          break;
        case "size":
          cmp = a.fileSize - b.fileSize;
          break;
        case "mostRead":
          cmp = (a.readCount ?? 0) - (b.readCount ?? 0);
          break;
        case "latestUpdate":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "myRead": {
          const statsA = userStats[a.id];
          const statsB = userStats[b.id];
          cmp = (statsA?.readCount ?? 0) - (statsB?.readCount ?? 0);
          if (cmp === 0) {
            const timeA = statsA?.lastReadAt ? new Date(statsA.lastReadAt).getTime() : 0;
            const timeB = statsB?.lastReadAt ? new Date(statsB.lastReadAt).getTime() : 0;
            cmp = timeA - timeB;
          }
          if (cmp === 0) {
            cmp = a.title.localeCompare(b.title);
            return sortDir === "desc" ? -cmp : cmp; // title always asc as tiebreaker
          }
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const handleDocumentDrop = async (targetGroupId: string) => {
    if (!draggingDocumentId) return;

    const draggedDocument = documents.find((doc) => doc.id === draggingDocumentId);
    if (!draggedDocument || draggedDocument.groupId === targetGroupId) {
      setDraggingDocumentId(null);
      setDropGroupId(null);
      return;
    }

    const res = await csrfFetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move-document",
        documentId: draggingDocumentId,
        groupId: targetGroupId,
      }),
    });

    setDraggingDocumentId(null);
    setDropGroupId(null);

    if (res.ok) {
      await fetchDocuments();
    }
  };

  const handleGroupDrop = async (targetGroupId: string) => {
    if (!draggingGroupId || draggingGroupId === targetGroupId) {
      setDraggingGroupId(null);
      setDropGroupId(null);
      return;
    }

    const orderedGroupIds = reorderIds(
      groups.map((group) => group.id),
      draggingGroupId,
      targetGroupId
    );

    setGroups((prev) => reorderCollection(prev, draggingGroupId, targetGroupId));
    setDraggingGroupId(null);
    setDropGroupId(null);

    const res = await csrfFetch("/api/document-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedGroupIds }),
    });

    if (!res.ok) {
      await fetchDocuments();
    }
  };

  const filteredDocs = searchQuery
    ? documents.filter((d) =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  const clearSearchQuery = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const groupedDocuments = groups.length > 0
    ? groups.map((group) => ({
        group,
        documents: sortDocuments(filteredDocs.filter((doc) => doc.groupId === group.id)),
      }))
    : [
        {
          group: {
            id: "fallback-group",
            userId: "default-user",
            name: t("untitledGroup"),
            position: 0,
            createdAt: "",
            updatedAt: "",
          },
          documents: sortDocuments(filteredDocs),
        },
      ];

  const sortFields: SortBy[] = isAuthenticated
    ? ["name", "size", "mostRead", "latestUpdate", "myRead"]
    : ["name", "size", "mostRead", "latestUpdate"];
  const sortLabel: Record<SortBy, string> = {
    name: t("sortName"),
    size: t("sortSize"),
    mostRead: t("sortMostRead"),
    latestUpdate: t("sortLatest"),
    myRead: "My Read",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-warm-orange)" }}
          >
            📚 {t("title")}
          </h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
          {isAdmin && <p className="mt-1 text-xs text-gray-400">{t("groupsHint")}</p>}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" onClick={() => setShowGroupForm((prev) => !prev)}>
              {showGroupForm ? "✕" : "🗂️"} {t("addGroup")}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowUpload(!showUpload)}>
              {showUpload ? "✕ Close" : `📖 ${t("upload")}`}
            </Button>
          )}
        </div>
      </div>

      {showGroupForm && (
        <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder={t("newGroupPlaceholder")}
            className="w-full rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm focus:border-sky-400 focus:outline-none sm:flex-1"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <Button variant="secondary" onClick={handleCreateGroup}>
            {t("createGroup")}
          </Button>
        </div>
      )}

      {showUpload && (
        <DocumentUpload
          groups={groups}
          onImport={handleImport}
          isUploading={isUploading}
          error={uploadError}
          success={uploadSuccess}
        />
      )}

      {documents.length === 0 && !showUpload && (
        <MascotGuide
          message={mascot("uploadHint")}
          mood="encouraging"
        />
      )}

      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="relative w-full"
            style={{ minHeight: "var(--min-touch-target)", width: "30rem", maxWidth: "100%" }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`🔍 ${t("search")}`}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pr-12 text-slate-700 shadow-sm focus:border-sky-300 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t("search")}
            />
            {searchQuery.length > 0 ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearSearchQuery}
                aria-label={t("clearSearch")}
                title={t("clearSearch")}
              >
                ✕
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            <span className="text-xs text-gray-400 mr-1">{t("sortBy")}:</span>
            {sortFields.map((field) => (
              <button
                key={field}
                onClick={() => handleSortChange(field)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  sortBy === field
                    ? "bg-sky-100 text-sky-700 border-sky-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 border-transparent"
                }`}
              >
                {sortLabel[field]}{sortBy === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {groupedDocuments.map(({ group, documents: groupDocuments }) => (
          <section
            key={group.id}
            className={`rounded-[24px] border-2 bg-white/95 p-4 shadow-sm transition-colors ${
              dropGroupId === group.id
                ? "border-sky-300 shadow-[0_0_0_4px_rgba(78,205,196,0.12)]"
                : "border-gray-100"
            }`}
            onDragOver={(e) => {
              if (draggingDocumentId || draggingGroupId) {
                e.preventDefault();
                setDropGroupId(group.id);
              }
            }}
            onDragLeave={() => setDropGroupId((current) => current === group.id ? null : current)}
            onDrop={(e) => {
              e.preventDefault();
              if (group.id === "fallback-group") {
                setDraggingDocumentId(null);
                setDraggingGroupId(null);
                setDropGroupId(null);
                return;
              }
              if (draggingDocumentId) {
                void handleDocumentDrop(group.id);
                return;
              }
              if (draggingGroupId) {
                void handleGroupDrop(group.id);
              }
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {isAdmin && group.id !== "fallback-group" ? (
                  <button
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDraggingGroupId(group.id);
                      setDraggingDocumentId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingGroupId(null);
                      setDropGroupId(null);
                    }}
                    className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 cursor-grab active:cursor-grabbing"
                    aria-label={t("dragGroup")}
                    title={t("dragGroup")}
                  >
                    ⋮⋮
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  {editingGroupId === group.id ? (
                    <div
                      className="flex w-full items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        className="min-w-0 rounded-lg border border-sky-300 px-2 py-1 text-base font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        style={{
                          width: `min(calc(100% - 9rem), max(14rem, ${Math.max(editingGroupName.length + 2, 10)}ch))`,
                          maxWidth: "calc(100% - 9rem)",
                        }}
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRenameGroup(group.id);
                          if (e.key === "Escape") {
                            setEditingGroupId(null);
                            setEditingGroupName("");
                          }
                        }}
                        autoFocus
                      />
                      <button
                        className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-sky-500 text-white hover:bg-sky-600"
                        onClick={() => void handleRenameGroup(group.id)}
                      >
                        {t("saveButton")}
                      </button>
                      <button
                        className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                        onClick={() => {
                          setEditingGroupId(null);
                          setEditingGroupName("");
                        }}
                      >
                        {t("cancelButton")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-800">
                        {group.name || t("untitledGroup")}
                      </h2>
                      {isAdmin && group.id !== "fallback-group" && (
                        <button
                          className="text-gray-400 hover:text-sky-500 transition-colors p-1 rounded-lg text-sm"
                          title={t("editGroupLabel")}
                          aria-label={t("editGroupLabel")}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditGroup(group);
                          }}
                        >
                          ✏️
                        </button>
                      )}
                      {isAdmin && group.id !== "fallback-group" && (
                        <button
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg text-sm"
                          title="Delete group"
                          aria-label="Delete group"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteGroup(group);
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{t("booksCount", { count: groupDocuments.length })}</p>
                </div>
              </div>
              {dropGroupId === group.id && draggingDocumentId ? (
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-sky-600">
                  {t("dropBookHere")}
                </span>
              ) : null}
            </div>

            {groupDocuments.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {groupDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    dragging={draggingDocumentId === doc.id}
                    isAdmin={isAdmin}
                    isAuthenticated={isAuthenticated}
                    personalStats={userStats[doc.id] ?? null}
                    onDelete={() => confirmDelete(doc.id, doc.title)}
                    onEdit={() => openEditDoc(doc)}
                    onDragStart={() => {
                      if (!isAdmin) return;
                      setDraggingDocumentId(doc.id);
                      setDraggingGroupId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingDocumentId(null);
                      setDropGroupId(null);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                {t("groupEmpty")}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      {deletingDocId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setDeletingDocId(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h2 className="text-lg font-black text-slate-800 mb-1">{t("deleteConfirm")}</h2>
              <p className="text-sm text-gray-500 line-clamp-2">{deletingDocTitle}</p>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
                onClick={() => setDeletingDocId(null)}
              >
                {t("cancelButton")}
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                onClick={() => void handleDelete()}
              >
                {t("menuDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete group confirmation dialog */}
      {deletingGroupId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setDeletingGroupId(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-4xl mb-3">🗂️</div>
              <h2 className="text-lg font-black text-slate-800 mb-1">Delete Group?</h2>
              <p className="text-sm text-gray-500 line-clamp-2">&ldquo;{deletingGroupName}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-2">Books in this group will be unassigned but not deleted.</p>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
                onClick={() => setDeletingGroupId(null)}
              >
                {t("cancelButton")}
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                onClick={() => void handleDeleteGroup()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite-only access request dialog */}
      {showInviteOnlyDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {!requestSent ? (
              <>
                <div className="text-center">
                  <div className="text-5xl mb-3">🔒</div>
                  <h2 className="text-xl font-black text-slate-800 mb-2">Invitation Only</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    This system is currently available to <span className="font-semibold">invited users only</span>.
                    Please contact an administrator to request access.
                  </p>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    You can submit a request below with your Google account email address and a brief message.
                    An administrator will review your request.
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    This system only supports login via Google.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Your Google Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                      placeholder="you@gmail.com"
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      disabled={requestBusy}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Message <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      className="w-full resize-none rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                      rows={3}
                      placeholder="Briefly describe why you need access..."
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      maxLength={500}
                      disabled={requestBusy}
                    />
                  </div>
                  {requestError && (
                    <p className="text-sm text-red-600">{requestError}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700
                      hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1
                      disabled:opacity-50"
                    onClick={() => setShowInviteOnlyDialog(false)}
                    disabled={requestBusy}
                  >
                    Close
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white
                      hover:bg-sky-600
                      focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => void handleRequestAccess()}
                    disabled={requestBusy || !requestEmail.trim()}
                  >
                    {requestBusy ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <h2 className="text-xl font-black text-slate-800 mb-2">Request Sent</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Your access request has been sent to the administrators.
                    Please wait for them to review and grant you access before trying to log in again.
                  </p>
                </div>
                <button
                  className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white
                    hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
                  onClick={() => setShowInviteOnlyDialog(false)}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit document modal */}
      {editingDoc && (
        <div
          className="fixed inset-0 z-50 flex justify-center p-0"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setEditingDoc(null)}
        >
          <div
            className="w-full max-w-lg bg-white shadow-2xl flex flex-col gap-4 overflow-y-auto mt-[60px] rounded-b-none rounded-t-3xl sm:rounded-3xl sm:mt-16 sm:max-h-[calc(100vh-5rem)] sm:self-start"
            style={{ padding: "1.5rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800">{t("editDocTitle")}</h2>
              <button
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                onClick={() => setEditingDoc(null)}
                aria-label={t("cancelButton")}
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-600">{t("editDocTitleLabel")}</label>
              <input
                type="text"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                value={editDocTitle}
                onChange={(e) => setEditDocTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-600">{t("editDocIconLabel")}</label>
              <input
                type="text"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                value={editDocIcon}
                onChange={(e) => setEditDocIcon(e.target.value)}
                placeholder="📗 or https://..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-600">{t("editDocContentLabel")}</label>
              <textarea
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none resize-y"
                rows={10}
                value={editDocContent}
                onChange={(e) => setEditDocContent(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
                onClick={() => setEditingDoc(null)}
                disabled={isSavingDoc}
              >
                {t("cancelButton")}
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 disabled:opacity-60"
                onClick={() => void handleUpdateDoc()}
                disabled={isSavingDoc || !editDocTitle.trim()}
              >
                {isSavingDoc ? t("savingButton") : t("saveButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  document: doc,
  dragging,
  isAdmin,
  isAuthenticated,
  personalStats,
  onDelete,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  document: Document;
  dragging: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  personalStats: UserReadingStats | null;
  onDelete: () => void;
  onEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations("library");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
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

  const wordCount = getWordCount(doc.content);
  const readMinutes = getRecommendedReadMinutes(doc.content);
  const isImgUrl = doc.icon
    ? doc.icon.startsWith("http://") || doc.icon.startsWith("https://")
    : false;

  const trackReadAndOpen = async () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);

    try {
      const response = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "increment-read-count",
          documentId: doc.id,
        }),
      });

      if (response.ok) {
        markReadCounted(doc.id);
      }
    } catch {
      // Ignore tracking failures and continue to reading page.
    } finally {
      router.push(`/read/${doc.id}`);
    }
  };

  return (
    <div
      draggable={isAdmin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative flex flex-col gap-3 p-4 rounded-2xl bg-white border-2 hover:border-sky-200 hover:shadow-md transition-all ${
        dragging ? "border-sky-300 opacity-70 shadow-md" : "border-gray-100"
      }`}
      data-document-card="true"
      data-document-title={doc.title}
    >
      {/* Three-dot menu (admin only) */}
      {isAdmin && (
      <div ref={menuRef} className="absolute top-3 right-3 z-10">
        <button
          className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="Options"
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-sky-50 flex items-center gap-2"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            >
              ✏️ {t("menuEdit")}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              🗑️ {t("menuDelete")}
            </button>
          </div>
        )}
      </div>
      )}

      {/* Top row: icon + title (right-padded to avoid menu overlap) */}
      <div className="flex gap-3 items-start pr-9">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 overflow-hidden text-2xl">
          {isImgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.icon!} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{doc.icon || (doc.fileType === "pdf" ? "📕" : "📄")}</span>
          )}
        </div>
        <h3 className="font-bold text-sm leading-snug line-clamp-3 flex-1">{doc.title}</h3>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-x-2 text-xs text-gray-400">
        <span>{t("wordCount", { count: wordCount.toLocaleString() })}</span>
        <span>•</span>
        <span>{t("readingTime", { min: readMinutes })}</span>
        <span className="ml-auto">{t("readCount", { count: doc.readCount ?? 0 })}</span>
      </div>

      {/* Personal stats row (authenticated users only) */}
      {isAuthenticated && (
        <div className="flex items-center justify-between text-xs text-gray-400 -mt-1">
          <span>
            ⏱{" "}
            {personalStats && personalStats.timedSessionCount > 0
              ? `${Math.round(personalStats.totalTimeSec / personalStats.timedSessionCount / 60)} min avg`
              : "-"}
          </span>
          <span>
            📖 My reads: {personalStats?.readCount ?? 0}
          </span>
        </div>
      )}

      {/* Read Now button */}
      <button
        type="button"
        className="btn-kid mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base text-center text-white disabled:cursor-not-allowed disabled:opacity-70"
        style={{ backgroundColor: "var(--color-sky-blue)" }}
        onClick={() => void trackReadAndOpen()}
        disabled={isOpening}
      >
        <span className="text-xl">📖</span>
        <span className="font-bold">{t("readNow")}</span>
      </button>
    </div>
  );
}

function reorderCollection<T extends { id: string }>(
  items: T[],
  sourceId: string,
  targetId: string
): T[] {
  const next = [...items];
  const sourceIndex = next.findIndex((item) => item.id === sourceId);
  const targetIndex = next.findIndex((item) => item.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return items;
  }

  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function reorderIds(
  ids: string[],
  sourceId: string,
  targetId: string
): string[] {
  return reorderCollection(
    ids.map((id) => ({ id })),
    sourceId,
    targetId
  ).map((item) => item.id);
}
