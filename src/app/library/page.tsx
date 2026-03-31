"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { DocumentUpload, type ImportParams } from "@/components/upload/DocumentUpload";
import { MascotGuide } from "@/components/mascot/MascotGuide";
import { Button } from "@/components/ui/Button";
import type { Document, DocumentGroup } from "@/types";

export default function LibraryPage() {
  const t = useTranslations("library");
  const mascot = useTranslations("mascot");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
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

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        setGroups(data.groups ?? []);
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
      const res = await fetch("/api/documents", {
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

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // Handle error silently
    }
  };

  const handleCreateGroup = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      return;
    }

    const res = await fetch("/api/document-groups", {
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

  const handleDocumentDrop = async (targetGroupId: string) => {
    if (!draggingDocumentId) {
      return;
    }

    const draggedDocument = documents.find((doc) => doc.id === draggingDocumentId);
    if (!draggedDocument || draggedDocument.groupId === targetGroupId) {
      setDraggingDocumentId(null);
      setDropGroupId(null);
      return;
    }

    const res = await fetch("/api/documents", {
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

    const res = await fetch("/api/document-groups", {
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

  const groupedDocuments = groups.length > 0
    ? groups.map((group) => ({
        group,
        documents: filteredDocs.filter((doc) => doc.groupId === group.id),
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
          documents: filteredDocs,
        },
      ];

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
          <p className="mt-1 text-xs text-gray-400">{t("groupsHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowGroupForm((prev) => !prev)}>
            {showGroupForm ? "✕" : "🗂️"} {t("addGroup")}
          </Button>
          <Button onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "✕ Close" : `📖 ${t("upload")}`}
          </Button>
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
        <input
          type="text"
          placeholder={`🔍 ${t("search")}`}
          className="w-full max-w-sm px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-sky-300 focus:outline-none"
          style={{ minHeight: "var(--min-touch-target)" }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("search")}
        />
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
              <div
                draggable={group.id !== "fallback-group"}
                onDragStart={() => {
                  if (group.id === "fallback-group") {
                    return;
                  }
                  setDraggingGroupId(group.id);
                  setDraggingDocumentId(null);
                }}
                onDragEnd={() => {
                  setDraggingGroupId(null);
                  setDropGroupId(null);
                }}
                className={`flex items-center gap-3 ${group.id === "fallback-group" ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                aria-label={t("dragGroup")}
                title={t("dragGroup")}
              >
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">⋮⋮</span>
                <div>
                  <h2 className="text-lg font-black text-slate-800">{group.name || t("untitledGroup")}</h2>
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
                    onDelete={() => handleDelete(doc.id)}
                    onDragStart={() => {
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
    </div>
  );
}

function DocumentCard({
  document: doc,
  dragging,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  document: Document;
  dragging: boolean;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations("library");
  const sizeKB = Math.round(doc.fileSize / 1024);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`p-5 rounded-2xl bg-white border-2 hover:border-sky-200 hover:shadow-md transition-all ${
        dragging ? "border-sky-300 opacity-70 shadow-md" : "border-gray-100"
      }`}
      data-document-card="true"
      data-document-title={doc.title}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">
          {doc.fileType === "pdf" ? "📕" : "📄"}
        </span>
        <span className="text-xs text-gray-400 uppercase">
          {doc.fileType}
        </span>
      </div>
      <h3 className="font-bold text-sm mb-1 line-clamp-2">{doc.title}</h3>
      <p className="text-xs text-gray-400 mb-4">{sizeKB} KB</p>
      <div className="flex gap-2">
        <Link
          href={`/read/${doc.id}`}
          className="btn-kid flex-1 px-3 py-2 text-sm text-center text-white rounded-xl"
          style={{ backgroundColor: "var(--color-sky-blue)" }}
        >
          📖 {t("readNow")}
        </Link>
        <button
          className="btn-kid px-3 py-2 text-sm rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-400"
          onClick={onDelete}
          aria-label={`${t("delete")} ${doc.title}`}
        >
          🗑
        </button>
      </div>
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
