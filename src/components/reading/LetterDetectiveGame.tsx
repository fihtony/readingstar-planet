"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { countLetter } from "@/lib/letter-confusion";
import { Button } from "@/components/ui/Button";

interface LetterDetectiveGameProps {
  text: string;
  onClose: () => void;
}

const TARGET_LETTERS = ["b", "d", "p", "q"] as const;

export function LetterDetectiveGame({
  text,
  onClose,
}: LetterDetectiveGameProps) {
  const t = useTranslations("game.detective");
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
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl border border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--color-lavender)" }}
            >
              {t("title")}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {t("instruction", { letter: targetLetter })}
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
          {text.split("").map((char, index) => {
            const isTarget = char.toLowerCase() === targetLetter;
            const isFound = foundPositions.includes(index);

            if (!isTarget) {
              return <span key={`${char}-${index}`}>{char}</span>;
            }

            return (
              <button
                key={`${char}-${index}`}
                type="button"
                className={`mx-[1px] rounded-md px-1 transition-colors ${
                  isFound
                    ? "bg-green-200 text-green-900"
                    : "bg-yellow-200 text-yellow-900 hover:bg-yellow-300"
                }`}
                onClick={() => handleMark(index)}
                aria-label={`Mark ${char} at position ${index + 1}`}
                disabled={isFound}
              >
                {char}
              </button>
            );
          })}
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
  );
}