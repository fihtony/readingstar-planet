"use client";

import React, { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { countLetter, CONFUSABLE_LETTERS } from "@/lib/letter-confusion";
import { Button } from "@/components/ui/Button";

interface LetterDetectiveGameProps {
  text: string;
  onClose: () => void;
}

const TARGET_LETTERS = ["b", "d", "p", "q"] as const;

/**
 * Split text into word/non-word tokens and render each word inside a
 * no-break inline-block span so that a target-letter <button> inside a
 * word can never be orphaned on a line by itself.
 */
function renderDetectiveText(
  text: string,
  targetLetter: string,
  foundPositions: number[],
  onMark: (index: number) => void,
): React.ReactNode {
  // Build a list of {segment, startIndex} tokens keeping absolute indices.
  const tokens: Array<{ segment: string; startIndex: number }> = [];
  // \S+ = word, \s+ = whitespace/newlines
  const re = /\S+|\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ segment: m[0], startIndex: m.index });
  }

  return tokens.map(({ segment, startIndex }) => {
    const isWhitespace = /^\s+$/.test(segment);

    if (isWhitespace) {
      return <span key={`ws-${startIndex}`}>{segment}</span>;
    }

    // Render each character of the word; wrap the whole word in a nowrap span.
    const chars = segment.split("").map((char, charOffset) => {
      const absIndex = startIndex + charOffset;
      const isTarget = char.toLowerCase() === targetLetter;
      const isFound = foundPositions.includes(absIndex);

      if (!isTarget) {
        return <span key={absIndex}>{char}</span>;
      }

      return (
        <button
          key={absIndex}
          type="button"
          className={`mx-[1px] rounded-md px-1 transition-colors ${
            isFound
              ? "bg-green-200 text-green-900"
              : "bg-yellow-200 text-yellow-900 hover:bg-yellow-300"
          }`}
          onClick={() => onMark(absIndex)}
          aria-label={`Mark ${char} at position ${absIndex + 1}`}
          disabled={isFound}
        >
          {char}
        </button>
      );
    });

    return (
      <span key={`word-${startIndex}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
        {chars}
      </span>
    );
  });
}

export function LetterDetectiveGame({
  text,
  onClose,
}: LetterDetectiveGameProps) {
  const t = useTranslations("game.detective");
  const locale = useLocale();
  const availableLetters = useMemo(
    () => TARGET_LETTERS.filter((letter) => countLetter(text, letter) > 0),
    [text]
  );
  const [targetLetter, setTargetLetter] = useState<string>(
    availableLetters[0] ?? "b"
  );
  const [foundPositions, setFoundPositions] = useState<number[]>([]);

  const total = countLetter(text, targetLetter);
  const isComplete = total > 0 && foundPositions.length === total;

  const handleTargetChange = (letter: string) => {
    setTargetLetter(letter);
    setFoundPositions([]);
  };

  const handleMark = (index: number) => {
    if (foundPositions.includes(index)) {
      return;
    }

    setFoundPositions((prev) => [...prev, index]);
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      <div className="flex min-h-full items-start justify-center p-4">
      <div className="my-4 w-full max-w-3xl shrink-0 rounded-3xl bg-white p-6 shadow-2xl border border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--color-lavender)" }}
            >
              {t("title")}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {(() => {
                const upper = targetLetter.toUpperCase();
                const lower = targetLetter.toLowerCase();
                const color = CONFUSABLE_LETTERS[targetLetter]?.colorHex ?? "#FF8C42";
                const hl = (letter: string) => (
                  <strong style={{ color, fontWeight: "bold" }}>{letter}</strong>
                );
                return locale === "zh" ? (
                  <>找出所有的 {hl(upper)} 和 {hl(lower)} 字母！点击它们来标记！</>
                ) : (
                  <>Find all the {hl(upper)} and {hl(lower)} letters! Tap them to mark!</>
                );
              })()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close letter detective game"
          >
            ✕
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableLetters.map((letter) => (
            <button
              key={letter}
              type="button"
              className={`btn-kid px-4 py-2 rounded-xl border-2 ${
                targetLetter === letter
                  ? "border-sky-300 bg-sky-100 text-sky-800"
                  : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
              onClick={() => handleTargetChange(letter)}
            >
              {letter.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[#FFF9F0] p-4 leading-8 text-lg">
          {renderDetectiveText(text, targetLetter, foundPositions, handleMark)}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="font-medium text-gray-700">
            {t("found")}: {foundPositions.length} / {total} {t("total")}
          </p>
          {isComplete ? (
            <p
              className="font-bold"
              style={{ color: "var(--color-grass-green)" }}
            >
              {t("complete")} {t("star")}
            </p>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}