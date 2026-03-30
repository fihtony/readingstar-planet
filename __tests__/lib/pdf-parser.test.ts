import { describe, it, expect } from "vitest";
import { validateFile, titleFromFilename } from "@/lib/pdf-parser";

// Note: extractTextFromPDF and extractTextFromTXT are hard to unit-test
// without real file buffers or heavy mocking of pdfjs-dist. We test them
// via integration/E2E tests instead.

describe("pdf-parser", () => {
  describe("validateFile", () => {
    it("accepts a valid PDF file", () => {
      const result = validateFile("test.pdf", "application/pdf", 1000);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe("pdf");
    });

    it("accepts a valid TXT file", () => {
      const result = validateFile("test.txt", "text/plain", 500);
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe("txt");
    });

    it("rejects unsupported types", () => {
      const result = validateFile("test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 500);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("rejects empty files", () => {
      const result = validateFile("test.pdf", "application/pdf", 0);
      expect(result.valid).toBe(false);
    });

    it("rejects PDF files over 20MB", () => {
      const result = validateFile("big.pdf", "application/pdf", 21 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    it("rejects TXT files over 5MB", () => {
      const result = validateFile("big.txt", "text/plain", 6 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });
  });

  describe("titleFromFilename", () => {
    it("removes file extension", () => {
      expect(titleFromFilename("my-book.pdf")).toBe("my book");
    });

    it("removes txt extension", () => {
      expect(titleFromFilename("story.txt")).toBe("story");
    });

    it("replaces dashes and underscores with spaces", () => {
      expect(titleFromFilename("my_great-book.pdf")).toBe("my great book");
    });

    it("handles files with multiple dots", () => {
      expect(titleFromFilename("chapter.1.final.pdf")).toBe("chapter.1.final");
    });
  });
});
