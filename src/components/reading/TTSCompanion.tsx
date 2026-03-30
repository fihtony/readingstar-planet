"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { splitIntoWords } from "@/lib/text-processor";

interface TTSCompanionProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentWordIndex: number;
  speed: number;
  isSupported: boolean;
  onPlay: (text: string, words: string[]) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  /** The full text of the current paragraph/line for playback */
  text: string;
}

const SPEED_OPTIONS = [0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0];

export function TTSCompanion({
  isPlaying,
  isPaused,
  speed,
  isSupported,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSpeedChange,
  text,
}: TTSCompanionProps) {
  const t = useTranslations("reading.tts");

  if (!isSupported) {
    return (
      <div
        className="text-sm p-3 rounded-xl bg-yellow-50"
        role="alert"
      >
        Text-to-speech is not supported in this browser.
      </div>
    );
  }

  const handlePlayPause = () => {
    if (isPlaying && !isPaused) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else {
      const words = splitIntoWords(text);
      onPlay(text, words);
    }
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-sky-50"
      role="toolbar"
      aria-label="Text-to-speech controls"
    >
      {/* Play/Pause button */}
      <button
        className="btn-kid flex items-center justify-center w-12 h-12 rounded-full text-white text-xl"
        style={{ backgroundColor: "var(--color-sky-blue)" }}
        onClick={handlePlayPause}
        aria-label={
          isPlaying && !isPaused
            ? "Pause reading"
            : isPaused
              ? "Resume reading"
              : t("play")
        }
      >
        {isPlaying && !isPaused ? "⏸" : "▶️"}
      </button>

      {/* Stop button */}
      {isPlaying && (
        <button
          className="btn-kid flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 text-xl"
          onClick={onStop}
          aria-label="Stop reading"
        >
          ⏹
        </button>
      )}

      {/* Speed control */}
      <div className="flex items-center gap-2">
        <label
          className="text-sm font-medium"
          htmlFor="tts-speed"
        >
          {t("speed")}:
        </label>
        <select
          id="tts-speed"
          className="rounded-lg px-2 py-1 text-sm border-2 border-gray-200"
          style={{ minHeight: "var(--min-touch-target)" }}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          aria-label={t("speed")}
        >
          {SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>

      {/* Playing indicator */}
      {isPlaying && !isPaused && (
        <div
          className="flex gap-1 items-end h-6"
          aria-hidden="true"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 bg-sky-400 rounded-full animate-pulse"
              style={{
                height: `${8 + i * 5}px`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders text with TTS word highlighting.
 * The currently spoken word is highlighted with a background color.
 */
interface TTSHighlightedTextProps {
  words: string[];
  currentWordIndex: number;
  isPlaying: boolean;
}

export function TTSHighlightedText({
  words,
  currentWordIndex,
  isPlaying,
}: TTSHighlightedTextProps) {
  return (
    <span>
      {words.map((word, i) => (
        <React.Fragment key={i}>
          <span
            className={
              isPlaying && i === currentWordIndex
                ? "tts-word-active"
                : ""
            }
          >
            {word}
          </span>
          {i < words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </span>
  );
}
