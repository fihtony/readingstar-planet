"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { DocumentUpload } from "@/components/upload/DocumentUpload";
import { MascotGuide } from "@/components/mascot/MascotGuide";
import { Button } from "@/components/ui/Button";
import type { Document } from "@/types";

export default function LibraryPage() {
  const t = useTranslations("library");
  const mascot = useTranslations("mascot");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
      }
    } catch {
      // Silently handle — empty state is fine for first load
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Something went wrong");
        return;
      }

      setUploadSuccess(true);
      setDocuments((prev) => [data.document, ...prev]);
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

  const filteredDocs = searchQuery
    ? documents.filter((d) =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

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
        </div>
        <Button onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? "✕ Close" : `📖 ${t("upload")}`}
        </Button>
      </div>

      {showUpload && (
        <DocumentUpload
          onUpload={handleUpload}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onDelete={() => handleDelete(doc.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentCard({
  document: doc,
  onDelete,
}: {
  document: Document;
  onDelete: () => void;
}) {
  const t = useTranslations("library");
  const sizeKB = Math.round(doc.fileSize / 1024);

  return (
    <div
      className="p-5 rounded-2xl bg-white border-2 border-gray-100 hover:border-sky-200 hover:shadow-md transition-all"
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
        <a
          href={`/read/${doc.id}`}
          className="btn-kid flex-1 px-3 py-2 text-sm text-center text-white rounded-xl"
          style={{ backgroundColor: "var(--color-sky-blue)" }}
        >
          📖 {t("readNow")}
        </a>
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
