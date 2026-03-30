"use client";

import React, { useState, useRef, type DragEvent } from "react";
import { useTranslations } from "next-intl";

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  error: string | null;
  success: boolean;
}

const ACCEPTED_TYPES = ".pdf,.txt";
const MAX_SIZE_DISPLAY = "20MB";

export function DocumentUpload({
  onUpload,
  isUploading,
  error,
  success,
}: DocumentUploadProps) {
  const t = useTranslations("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (file) {
      await onUpload(file);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
    }
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Drop zone */}
      <div
        className={`
          relative flex flex-col items-center justify-center
          p-8 rounded-2xl border-3 border-dashed
          transition-all duration-300 cursor-pointer
          ${isDragOver
            ? "border-sky-400 bg-sky-50 scale-105"
            : "border-gray-300 bg-white hover:border-sky-300 hover:bg-sky-50/50"
          }
        `}
        style={{ minHeight: "200px" }}
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

        {isUploading ? (
          <UploadingState />
        ) : success ? (
          <SuccessState />
        ) : (
          <IdleState isDragOver={isDragOver} />
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="mt-3 p-3 rounded-xl text-center text-sm"
          style={{
            backgroundColor: "#FFF3E0",
            color: "#E65100",
          }}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}

function IdleState({ isDragOver }: { isDragOver: boolean }) {
  const t = useTranslations("upload");

  return (
    <>
      <div className="text-5xl mb-4" aria-hidden="true">
        {isDragOver ? "📖" : "📚"}
      </div>
      <p className="text-lg font-bold mb-2">
        {isDragOver ? "Drop it here!" : t("title")}
      </p>
      <p className="text-sm text-gray-500 mb-4">
        {t("dragDrop")}
      </p>
      <div
        className="btn-kid px-6 py-3 text-white text-sm"
        style={{ backgroundColor: "var(--color-warm-orange)" }}
      >
        {t("browse")}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        {t("supportedFormats")}
      </p>
    </>
  );
}

function UploadingState() {
  const t = useTranslations("upload");

  return (
    <>
      <div
        className="text-5xl mb-4 animate-bounce"
        aria-hidden="true"
      >
        🦉
      </div>
      <p className="text-lg font-bold">
        {t("uploading")}
      </p>
      <div
        className="mt-3 w-48 h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
      >
        <div
          className="h-full rounded-full animate-pulse"
          style={{
            backgroundColor: "var(--color-sky-blue)",
            width: "60%",
          }}
        />
      </div>
    </>
  );
}

function SuccessState() {
  const t = useTranslations("upload");

  return (
    <>
      <div className="text-5xl mb-4" aria-hidden="true">
        🎉
      </div>
      <p
        className="text-lg font-bold"
        style={{ color: "var(--color-grass-green)" }}
      >
        {t("success")}
      </p>
    </>
  );
}
