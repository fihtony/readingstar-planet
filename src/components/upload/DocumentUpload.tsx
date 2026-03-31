"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type DragEvent,
} from "react";
import { useTranslations } from "next-intl";
import type { DocumentGroup } from "@/types";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ImportParams {
  title: string;
  content: string;
  groupId: string | null;
}

interface DocumentUploadProps {
  groups: DocumentGroup[];
  onImport: (params: ImportParams) => Promise<void>;
  isUploading: boolean;
  error: string | null;
  success: boolean;
}

// ── Internal types ────────────────────────────────────────────────────────────

type SourceTab = "file" | "text";
type Step = "input" | "preview";

const ACCEPTED_TYPES = ".pdf,.txt";

// ── Helpers ───────────────────────────────────────────────────────────────────

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromText(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  return firstLine.trim().slice(0, 60) || "";
}

// ── Main component ────────────────────────────────────────────────────────────

export function DocumentUpload({
  groups,
  onImport,
  isUploading,
  error,
  success,
}: DocumentUploadProps) {
  const t = useTranslations("upload");

  const [step, setStep] = useState<Step>("input");
  const [sourceTab, setSourceTab] = useState<SourceTab>("file");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Preview / edit state
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

  // Paste-text tab state
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep default group in sync as groups load
  useEffect(() => {
    if (groups.length > 0 && previewGroupId === null) {
      setPreviewGroupId(groups[0].id);
    }
  }, [groups, previewGroupId]);

  const openPreview = useCallback(
    (title: string, content: string) => {
      setPreviewTitle(title);
      setPreviewContent(content);
      setPreviewGroupId(groups[0]?.id ?? null);
      setStep("preview");
    },
    [groups]
  );

  // ── File extraction ───────────────────────────────────────────────────────

  const extractAndPreview = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setParseError(null);

      try {
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "pdf") {
          // PDF: send to server for extraction
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/documents/preview", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const data = await res.json();
            setParseError(data.error ?? "Failed to read PDF");
            return;
          }
          const data = await res.json();
          openPreview(data.title as string, data.content as string);
        } else {
          // TXT: decode client-side
          const buffer = await file.arrayBuffer();
          const content = new TextDecoder("utf-8").decode(buffer);
          openPreview(titleFromFilename(file.name), content);
        }
      } catch {
        setParseError("Could not read the file. Please try again.");
      } finally {
        setIsParsing(false);
      }
    },
    [openPreview]
  );

  // ── Drag handlers (file tab) ──────────────────────────────────────────────

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await extractAndPreview(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await extractAndPreview(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Text paste tab ────────────────────────────────────────────────────────

  const handleTextPreview = () => {
    if (!pasteContent.trim()) return;
    const title =
      pasteTitle.trim() ||
      titleFromText(pasteContent) ||
      t("untitledBook");
    openPreview(title, pasteContent);
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    await onImport({
      title: previewTitle.trim() || t("untitledBook"),
      content: previewContent,
      groupId: previewGroupId,
    });
  };

  const resetToInput = () => {
    setStep("input");
    setParseError(null);
    setPreviewTitle("");
    setPreviewContent("");
  };

  // ── Render: success ───────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-green-300 bg-green-50 p-8 text-center">
        <div className="text-5xl" aria-hidden="true">🎉</div>
        <p className="text-lg font-bold text-green-700">{t("success")}</p>
      </div>
    );
  }

  // ── Render: importing ─────────────────────────────────────────────────────

  if (isUploading) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-8 text-center">
        <div className="text-5xl animate-bounce" aria-hidden="true">🦉</div>
        <p className="text-lg font-bold">{t("uploading")}</p>
      </div>
    );
  }

  // ── Render: preview / edit ────────────────────────────────────────────────

  if (step === "preview") {
    return (
      <PreviewStep
        title={previewTitle}
        content={previewContent}
        groupId={previewGroupId}
        groups={groups}
        error={error}
        onTitleChange={setPreviewTitle}
        onContentChange={setPreviewContent}
        onGroupChange={setPreviewGroupId}
        onBack={resetToInput}
        onImport={handleImport}
      />
    );
  }

  // ── Render: input ─────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* Source tabs */}
      <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
            sourceTab === "file"
              ? "bg-white shadow-sm text-sky-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setSourceTab("file")}
        >
          📂 {t("uploadFileTab")}
        </button>
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
            sourceTab === "text"
              ? "bg-white shadow-sm text-sky-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setSourceTab("text")}
        >
          📝 {t("pasteTextTab")}
        </button>
      </div>

      {/* File upload tab */}
      {sourceTab === "file" && (
        <div className="flex flex-col gap-3">
          {isParsing ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-8 text-center">
              <div className="text-4xl animate-pulse" aria-hidden="true">📄</div>
              <p className="text-sm font-bold text-sky-600">{t("parsingPdf")}</p>
            </div>
          ) : (
            <div
              className={`relative flex flex-col items-center justify-center p-8 rounded-2xl border-4 border-dashed transition-all duration-300 cursor-pointer ${
                isDragOver
                  ? "border-sky-400 bg-sky-50 scale-105"
                  : "border-gray-300 bg-white hover:border-sky-300 hover:bg-sky-50/50"
              }`}
              style={{ minHeight: "180px" }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={`${t("title")}. ${t("dragDrop")}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileChange}
                className="sr-only"
                aria-hidden="true"
              />
              <div className="text-4xl mb-3" aria-hidden="true">
                {isDragOver ? "📖" : "📚"}
              </div>
              <p className="text-base font-bold mb-1">
                {isDragOver ? "Drop it here!" : t("dragDrop")}
              </p>
              <div
                className="btn-kid px-5 py-2 text-white text-sm mt-2"
                style={{ backgroundColor: "var(--color-warm-orange)" }}
              >
                {t("browse")}
              </div>
              <p className="text-xs text-gray-400 mt-2">{t("supportedFormats")}</p>
            </div>
          )}
          {(parseError ?? error) && (
            <div
              className="rounded-xl bg-orange-50 p-3 text-center text-sm text-orange-700"
              role="alert"
            >
              {parseError ?? error}
            </div>
          )}
        </div>
      )}

      {/* Paste text tab */}
      {sourceTab === "text" && (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder={t("titlePlaceholder")}
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none"
            aria-label={t("textTitle")}
          />
          <textarea
            placeholder={t("contentPlaceholder")}
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none resize-y"
            rows={8}
            aria-label={t("contentLabel")}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {pasteContent.length > 0
                ? `${pasteContent.length} characters`
                : ""}
            </p>
            <button
              className="btn-kid px-6 py-3 text-sm font-bold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--color-sky-blue)" }}
              onClick={handleTextPreview}
              disabled={!pasteContent.trim()}
            >
              {t("previewEdit")} →
            </button>
          </div>
          {error && (
            <div
              className="rounded-xl bg-orange-50 p-3 text-center text-sm text-orange-700"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Preview / edit step ───────────────────────────────────────────────────────

function PreviewStep({
  title,
  content,
  groupId,
  groups,
  error,
  onTitleChange,
  onContentChange,
  onGroupChange,
  onBack,
  onImport,
}: {
  title: string;
  content: string;
  groupId: string | null;
  groups: DocumentGroup[];
  error: string | null;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onGroupChange: (v: string | null) => void;
  onBack: () => void;
  onImport: () => Promise<void>;
}) {
  const t = useTranslations("upload");
  const [isEditingContent, setIsEditingContent] = useState(false);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <h3 className="text-base font-bold text-slate-700">
        ✏️ {t("previewTitle")}
      </h3>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
          {t("textTitle")}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="rounded-xl border-2 border-sky-200 px-4 py-3 text-sm font-bold focus:border-sky-400 focus:outline-none"
          placeholder={t("titlePlaceholder")}
        />
      </div>

      {/* Group selector */}
      {groups.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {t("importGroup")}
          </label>
          <select
            value={groupId ?? ""}
            onChange={(e) => onGroupChange(e.target.value || null)}
            className="rounded-xl border-2 border-sky-200 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none bg-white"
          >
            <option value="">{t("noGroup")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content preview / editor */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {t("contentLabel")}
          </label>
          <button
            className="text-xs text-sky-600 font-bold hover:underline"
            onClick={() => setIsEditingContent((v) => !v)}
          >
            {isEditingContent ? "▲ Collapse" : "✏️ Edit"}
          </button>
        </div>
        {isEditingContent ? (
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full rounded-xl border-2 border-sky-200 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none resize-y font-mono"
            rows={14}
            aria-label={t("contentLabel")}
          />
        ) : (
          <div
            className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 max-h-52 overflow-y-auto whitespace-pre-wrap cursor-text"
            onClick={() => setIsEditingContent(true)}
            title="Click to edit"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setIsEditingContent(true);
            }}
          >
            {content.slice(0, 1200)}
            {content.length > 1200 && (
              <span className="text-gray-400">
                {" "}
                … ({content.length - 1200} more characters)
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-gray-400 text-right">
          {content.length} characters
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl bg-orange-50 p-3 text-center text-sm text-orange-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between gap-3">
        <button
          className="btn-kid px-5 py-3 text-sm font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
          onClick={onBack}
        >
          ← {t("backButton")}
        </button>
        <button
          className="btn-kid px-6 py-3 text-sm font-bold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--color-warm-orange)" }}
          onClick={onImport}
          disabled={!title.trim() || !content.trim()}
        >
          📥 {t("importButton")}
        </button>
      </div>
    </div>
  );
}
