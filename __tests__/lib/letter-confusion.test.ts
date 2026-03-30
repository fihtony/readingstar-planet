import { describe, it, expect } from "vitest";
import {
  annotateText,
  countLetter,
  findLetterPositions,
  isConfusableLetter,
  getLetterInfo,
  CONFUSABLE_LETTERS,
} from "@/lib/letter-confusion";

describe("letter-confusion", () => {
  describe("CONFUSABLE_LETTERS", () => {
    it("has entries for b, d, p, q", () => {
      expect(CONFUSABLE_LETTERS).toHaveProperty("b");
      expect(CONFUSABLE_LETTERS).toHaveProperty("d");
      expect(CONFUSABLE_LETTERS).toHaveProperty("p");
      expect(CONFUSABLE_LETTERS).toHaveProperty("q");
    });

    it("each entry has colorHex and mnemonic", () => {
      for (const info of Object.values(CONFUSABLE_LETTERS)) {
        expect(info).toHaveProperty("colorHex");
        expect(info).toHaveProperty("mnemonic");
        expect(typeof info.colorHex).toBe("string");
        expect(typeof info.mnemonic).toBe("string");
      }
    });
  });

  describe("isConfusableLetter", () => {
    it("returns true for b, d, p, q", () => {
      expect(isConfusableLetter("b")).toBe(true);
      expect(isConfusableLetter("d")).toBe(true);
      expect(isConfusableLetter("p")).toBe(true);
      expect(isConfusableLetter("q")).toBe(true);
    });

    it("returns true for uppercase variants", () => {
      expect(isConfusableLetter("B")).toBe(true);
      expect(isConfusableLetter("D")).toBe(true);
    });

    it("returns false for non-confusable letters", () => {
      expect(isConfusableLetter("a")).toBe(false);
      expect(isConfusableLetter("z")).toBe(false);
      expect(isConfusableLetter("1")).toBe(false);
    });
  });

  describe("getLetterInfo", () => {
    it("returns info for confusable letters", () => {
      const info = getLetterInfo("b");
      expect(info).toBeDefined();
      expect(info!.colorHex).toBeDefined();
      expect(info!.mnemonic).toBeDefined();
    });

    it("returns null for non-confusable letters", () => {
      expect(getLetterInfo("a")).toBeNull();
    });
  });

  describe("annotateText", () => {
    it("segments text into regular and confusable parts", () => {
      const result = annotateText("bad");
      expect(result.length).toBeGreaterThan(0);

      const confusable = result.filter((s) => s.isConfusable);
      expect(confusable.length).toBe(2); // 'b' and 'd'
    });

    it("returns a single segment for text without confusables", () => {
      const result = annotateText("cat");
      expect(result).toEqual([
        { text: "cat", isConfusable: false, letterInfo: null },
      ]);
    });

    it("handles empty string", () => {
      const result = annotateText("");
      expect(result).toEqual([]);
    });

    it("handles all confusable letters", () => {
      const result = annotateText("bdpq");
      const confusable = result.filter((s) => s.isConfusable);
      expect(confusable).toHaveLength(4);
    });

    it("preserves the original text across segments", () => {
      const input = "the bed is big";
      const result = annotateText(input);
      const reconstructed = result.map((s) => s.text).join("");
      expect(reconstructed).toBe(input);
    });

    it("includes letter info for confusable segments", () => {
      const result = annotateText("b");
      expect(result[0].letterInfo).toBeDefined();
      expect(result[0].letterInfo!.colorHex).toBe(CONFUSABLE_LETTERS["b"].colorHex);
    });
  });

  describe("countLetter", () => {
    it("counts occurrences of a letter (case-insensitive)", () => {
      expect(countLetter("banana", "b")).toBe(1);
      expect(countLetter("banana", "a")).toBe(3);
    });

    it("handles uppercase", () => {
      expect(countLetter("Banana", "b")).toBe(1);
    });

    it("returns 0 when letter not found", () => {
      expect(countLetter("hello", "z")).toBe(0);
    });
  });

  describe("findLetterPositions", () => {
    it("returns positions of the letter (case-insensitive)", () => {
      const positions = findLetterPositions("abcbd", "b");
      expect(positions).toEqual([1, 3]);
    });

    it("returns empty array when letter not found", () => {
      expect(findLetterPositions("hello", "z")).toEqual([]);
    });
  });
});
