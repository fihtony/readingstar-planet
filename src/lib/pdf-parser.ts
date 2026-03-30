/**
 * PDF text extraction utility.
 * Uses pdfjs-dist to extract text content from PDF files.
 */

import type { FileValidationResult, FileType } from "@/types";

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_TXT_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, FileType> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
};
const ALLOWED_EXTENSIONS: Record<string, FileType> = {
  ".pdf": "pdf",
  ".txt": "txt",
};

/**
 * Validate an uploaded file before processing.
 */
export function validateFile(
  filename: string,
  mimeType: string,
  size: number
): FileValidationResult {
  // Check extension
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  const extType = ALLOWED_EXTENSIONS[ext];
  const mimeFileType = ALLOWED_TYPES[mimeType];

  // Must match either extension or MIME type
  const fileType = extType || mimeFileType;
  if (!fileType) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: PDF, TXT`,
    };
  }

  // Check size limits
  const maxSize = fileType === "pdf" ? MAX_PDF_SIZE : MAX_TXT_SIZE;
  if (size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File too large. Maximum size for ${fileType.toUpperCase()} is ${maxMB}MB`,
    };
  }

  if (size === 0) {
    return { valid: false, error: "File is empty" };
  }

  return { valid: true, fileType };
}

/**
 * Extract text from a PDF buffer using pdfjs-dist.
 * Runs on the server side.
 */
export async function extractTextFromPDF(
  buffer: ArrayBuffer
): Promise<string> {
  // Dynamic import to avoid bundling issues on client
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    if (pageText.trim()) {
      textParts.push(pageText.trim());
    }
  }

  return textParts.join("\n\n");
}

/**
 * Extract text from a plain text buffer.
 */
export function extractTextFromTXT(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(buffer);
}

/**
 * Generate a title from the filename by removing extension and cleaning up.
 */
export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[_-]+/g, " ") // Replace underscores/hyphens with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}
