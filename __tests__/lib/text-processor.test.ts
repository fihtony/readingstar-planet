import { describe, it, expect } from "vitest";
import {
  parseReadingContent,
  splitIntoLines,
  splitIntoParagraphs,
  splitIntoWords,
  countWords,
  wrapText,
  sanitizeTextContent,
} from "@/lib/text-processor";

describe("text-processor", () => {
  describe("splitIntoLines", () => {
    it("splits text by newline", () => {
      const result = splitIntoLines("line one\nline two\nline three");
      expect(result).toEqual(["line one", "line two", "line three"]);
    });

    it("handles \\r\\n line endings", () => {
      const result = splitIntoLines("hello\r\nworld");
      expect(result).toEqual(["hello", "world"]);
    });

    it("filters out blank lines", () => {
      const result = splitIntoLines("hello\n\n\nworld");
      expect(result).toEqual(["hello", "world"]);
    });

    it("trims whitespace from each line", () => {
      const result = splitIntoLines("  hello  \n  world  ");
      expect(result).toEqual(["hello", "world"]);
    });

    it("wraps long lines at maxLineLength", () => {
      const longLine = "a ".repeat(60).trim(); // 119 chars
      const result = splitIntoLines(longLine, 40);
      expect(result.length).toBeGreaterThan(1);
      result.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(40);
      });
    });

    it("returns empty array for empty string", () => {
      expect(splitIntoLines("")).toEqual([]);
    });

    it("returns empty array for whitespace-only input", () => {
      expect(splitIntoLines("   \n  \n  ")).toEqual([]);
    });
  });

  describe("wrapText", () => {
    it("wraps text at word boundaries", () => {
      const text = "the quick brown fox jumps over the lazy dog";
      const result = wrapText(text, 20);
      result.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(20);
      });
    });

    it("handles a single long word", () => {
      const text = "superlongword";
      const result = wrapText(text, 5);
      expect(result).toEqual(["superlongword"]);
    });

    it("returns the text as-is when within limit", () => {
      const text = "short";
      const result = wrapText(text, 80);
      expect(result).toEqual(["short"]);
    });
  });

  describe("splitIntoParagraphs", () => {
    it("keeps paragraphs separated by indentation or blank lines", () => {
      const result = splitIntoParagraphs("    Para one line one.\nline two.\n\n    Para two.");
      expect(result).toEqual(["Para one line one. line two.", "Para two."]);
    });

    it("normalizes wrapped paragraph lines", () => {
      const result = splitIntoParagraphs("    Para one line one.\nline two.\n    Para two line one.\nline two.");
      expect(result).toEqual([
        "Para one line one. line two.",
        "Para two line one. line two.",
      ]);
    });

    it("returns empty array for empty string", () => {
      expect(splitIntoParagraphs("")).toEqual([]);
    });
  });

  describe("splitIntoWords", () => {
    it("splits on whitespace", () => {
      expect(splitIntoWords("hello world foo")).toEqual([
        "hello",
        "world",
        "foo",
      ]);
    });

    it("handles multiple spaces", () => {
      expect(splitIntoWords("hello   world")).toEqual(["hello", "world"]);
    });

    it("returns empty array for empty string", () => {
      expect(splitIntoWords("")).toEqual([]);
    });
  });

  describe("countWords", () => {
    it("returns correct word count", () => {
      expect(countWords("the quick brown fox")).toBe(4);
    });

    it("returns 0 for empty string", () => {
      expect(countWords("")).toBe(0);
    });

    it("handles extra whitespace", () => {
      expect(countWords("  hello   world  ")).toBe(2);
    });
  });

  describe("sanitizeTextContent", () => {
    it("removes HTML tags", () => {
      expect(sanitizeTextContent("<p>hello</p>")).toBe("hello");
    });

    it("removes script tags and content", () => {
      const result = sanitizeTextContent(
        "before<script>alert('xss')</script>after"
      );
      expect(result).not.toContain("script");
      expect(result).not.toContain("alert");
    });

    it("preserves leading paragraph indentation", () => {
      expect(sanitizeTextContent("    hello\n    world")).toBe("    hello\n    world");
    });

    it("trims trailing whitespace without removing leading spaces", () => {
      expect(sanitizeTextContent("    hello   \nworld   ")).toBe("    hello\nworld");
    });

    it("handles empty string", () => {
      expect(sanitizeTextContent("")).toBe("");
    });
  });

  describe("parseReadingContent", () => {
    it("preserves paragraph indentation metadata", () => {
      const result = parseReadingContent("    First paragraph sentence.\nSecond line.\n\n    Next paragraph.");

      expect(result.paragraphStartIndices).toEqual([0, 2]);
      expect(result.leadingWhitespaceByIndex[0]).toBe("    ");
      expect(result.leadingWhitespaceByIndex[2]).toBe("    ");
    });

    it("splits at natural clause boundaries when the comma starts a new clause", () => {
      const result = parseReadingContent(
        "    When you bounce a ball or ride a bike, you use energy from your body to make the ball move."
      );

      expect(result.lines).toEqual([
        "When you bounce a ball or ride a bike,",
        "you use energy from your body to make the ball move.",
      ]);
    });

    it("does not split list-like or awkward comma sentences", () => {
      const result = parseReadingContent(
        "    Each morning, Ollie watched the older otters dive, spin, and splash through the bright water.\n    When the soccer player kicks the ball, kinetic energy is at work there, too."
      );

      expect(result.lines).toEqual([
        "Each morning, Ollie watched the older otters dive, spin, and splash through the bright water.",
        "When the soccer player kicks the ball, kinetic energy is at work there, too.",
      ]);
    });
  });
});
