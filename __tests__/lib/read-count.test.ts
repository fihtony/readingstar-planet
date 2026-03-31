import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_READ_COUNT_COOLDOWN_MS,
  MIN_READ_COUNT_COOLDOWN_MS,
  getReadCountCooldownMs,
  getReadCountCooldownMsForContent,
  getRecommendedReadMinutes,
  getWordCount,
  markReadCounted,
  shouldCountReadOnRefresh,
} from "@/lib/read-count";

function repeatWord(word: string, count: number): string {
  return Array.from({ length: count }, () => word).join(" ");
}

describe("read-count", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("counts words and estimates recommended reading time", () => {
    expect(getWordCount("one two three")).toBe(3);
    expect(getRecommendedReadMinutes("one two three")).toBe(1);
    expect(getRecommendedReadMinutes(repeatWord("word", 600))).toBe(3);
    expect(getRecommendedReadMinutes(repeatWord("word", 800))).toBe(4);
  });

  it("uses 30 minutes for articles whose recommended time is 3 minutes or less", () => {
    expect(getReadCountCooldownMs(1)).toBe(MIN_READ_COUNT_COOLDOWN_MS);
    expect(getReadCountCooldownMs(3)).toBe(MIN_READ_COUNT_COOLDOWN_MS);
    expect(getReadCountCooldownMsForContent(repeatWord("word", 600))).toBe(
      MIN_READ_COUNT_COOLDOWN_MS
    );
  });

  it("uses 1 hour for articles whose recommended time is longer than 3 minutes", () => {
    expect(getReadCountCooldownMs(4)).toBe(MAX_READ_COUNT_COOLDOWN_MS);
    expect(getReadCountCooldownMsForContent(repeatWord("word", 800))).toBe(
      MAX_READ_COUNT_COOLDOWN_MS
    );
  });

  it("only counts refreshes after the cooldown window has elapsed", () => {
    vi.setSystemTime(new Date("2026-03-31T09:00:00.000Z"));

    markReadCounted("doc-1");

    expect(
      shouldCountReadOnRefresh(
        "doc-1",
        MIN_READ_COUNT_COOLDOWN_MS,
        Date.now() + MIN_READ_COUNT_COOLDOWN_MS - 1000
      )
    ).toBe(false);

    expect(
      shouldCountReadOnRefresh(
        "doc-1",
        MIN_READ_COUNT_COOLDOWN_MS,
        Date.now() + MIN_READ_COUNT_COOLDOWN_MS
      )
    ).toBe(true);
  });
});