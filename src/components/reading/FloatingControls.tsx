"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { splitIntoWords } from "@/lib/text-processor";

/* ------------------------------------------------------------------ */
/*  Floating bottom bar with TTS + Follow-along controls              */
/* ------------------------------------------------------------------ */

interface FloatingControlsProps {
  /* TTS */
  ttsSupported: boolean;
  ttsPlaying: boolean;
  ttsPaused: boolean;
  currentText: string;
  onTtsPlay: (text: string, words: string[]) => void;
  onTtsPause: () => void;
  onTtsResume: () => void;
  onTtsStop: () => void;
  /* Follow-along */
  followAlongActive: boolean;
  onFollowAlongStart: () => void;
  onFollowAlongStop: () => void;
  followAlongSupported: boolean;
}

export function FloatingControls({
  ttsSupported,
  ttsPlaying,
  ttsPaused,
  currentText,
  onTtsPlay,
  onTtsPause,
  onTtsResume,
  onTtsStop,
  followAlongActive,
  onFollowAlongStart,
  onFollowAlongStop,
  followAlongSupported,
}: FloatingControlsProps) {
  // Draggable position — null means "use default CSS (bottom-center)"
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragActive = useRef(false);
  const dragOrigin = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragActive.current || !barRef.current) return;
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const halfW = barRef.current.offsetWidth / 2;
      const halfH = barRef.current.offsetHeight / 2;
      setPos({
        x: Math.max(
          halfW,
          Math.min(
            window.innerWidth - halfW,
            dragOrigin.current.posX + clientX - dragOrigin.current.mouseX
          )
        ),
        y: Math.max(
          halfH,
          Math.min(
            window.innerHeight - halfH,
            dragOrigin.current.posY + clientY - dragOrigin.current.mouseY
          )
        ),
      });
    };
    const onUp = () => {
      dragActive.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const handleDragStart = (
    e: React.MouseEvent | React.TouchEvent
  ) => {
    const clientX =
      "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : e.clientY;
    let currentX: number;
    let currentY: number;
    if (pos) {
      currentX = pos.x;
      currentY = pos.y;
    } else if (barRef.current) {
      const rect = barRef.current.getBoundingClientRect();
      currentX = rect.left + rect.width / 2;
      currentY = rect.top + rect.height / 2;
    } else {
      return;
    }
    dragActive.current = true;
    dragOrigin.current = {
      mouseX: clientX,
      mouseY: clientY,
      posX: currentX,
      posY: currentY,
    };
  };

  const containerStyle: React.CSSProperties = pos
    ? {
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        bottom: "auto",
      }
    : {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
      };

  const handlePlayPause = () => {
    if (ttsPlaying && !ttsPaused) {
      onTtsPause();
    } else if (ttsPaused) {
      onTtsResume();
    } else {
      const words = splitIntoWords(currentText);
      onTtsPlay(currentText, words);
    }
  };

  return (
    <div
      ref={barRef}
      style={{ ...containerStyle, zIndex: 50 }}
      className="flex flex-nowrap items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-2 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.12)] backdrop-blur-md border border-gray-200/60"
      role="toolbar"
      aria-label="Reading controls"
    >
      {/* Drag handle — compact 3x2 grip */}
      <div
        className="cursor-grab active:cursor-grabbing touch-none select-none flex flex-col gap-[1.5px] px-0.5 py-0.5"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        aria-hidden="true"
        title="Drag to move"
      >
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-[1.5px]">
            {[0, 1].map((col) => (
              <div
                key={col}
                className="h-[2.25px] w-[2.25px] rounded-full bg-gray-300"
              />
            ))}
          </div>
        ))}
      </div>

      {/* Divider after drag handle */}
      <div className="h-7 w-px bg-gray-200" aria-hidden="true" />

      {/* TTS Play / Pause */}
      {ttsSupported && (
        <>
          <button
            className="btn-kid flex h-12 w-12 items-center justify-center rounded-full text-white text-xl shadow-md"
            style={{ backgroundColor: "var(--color-sky-blue)" }}
            onClick={handlePlayPause}
            aria-label={
              ttsPlaying && !ttsPaused
                ? "Pause"
                : ttsPaused
                  ? "Resume"
                  : "Play"
            }
          >
            {ttsPlaying && !ttsPaused ? "⏸" : "▶️"}
          </button>

          {/* Stop */}
          {ttsPlaying && (
            <button
              className="btn-kid flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg"
              onClick={onTtsStop}
              aria-label="Stop"
            >
              ⏹
            </button>
          )}

          {/* Playing indicator */}
          {ttsPlaying && !ttsPaused && (
            <div className="flex gap-[3px] items-end h-5" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-sky-400 animate-pulse"
                  style={{
                    height: `${6 + i * 4}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Divider */}
      {ttsSupported && followAlongSupported && (
        <div className="h-8 w-px bg-gray-200" aria-hidden="true" />
      )}

      {/* Follow Along */}
      {followAlongSupported && (
        <button
          className={`btn-kid flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors ${
            followAlongActive
              ? "bg-red-100 text-red-700 border-2 border-red-300"
              : "bg-yellow-50 text-yellow-800 border-2 border-yellow-200"
          }`}
          onClick={followAlongActive ? onFollowAlongStop : onFollowAlongStart}
          aria-pressed={followAlongActive}
        >
          {followAlongActive ? "⏹ Stop" : "🎙 Read Aloud"}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline diff display for Follow-along transcript                   */
/* ------------------------------------------------------------------ */

interface FollowAlongInlineDiffProps {
  expectedText: string;
  transcript: string;
  score: number | null;
}

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Align expected and actual words using Longest Common Subsequence (LCS)
 * to produce a merged token stream.
 */
type DiffToken =
  | { type: "match"; word: string; count: number }
  | { type: "missing"; word: string }
  | { type: "extra"; word: string };

function diffWords(expected: string[], actual: string[]): DiffToken[] {
  const m = expected.length;
  const n = actual.length;
  const joinWords = (words: string[]) => words.map(normalizeWord).join("");

  // Build DP table with support for merged/split word matches.
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);

      if (normalizeWord(expected[i - 1]) === normalizeWord(actual[j - 1])) {
        dp[i][j] = Math.max(dp[i][j], dp[i - 1][j - 1] + 1);
      }

      if (
        i >= 2 &&
        joinWords([expected[i - 2], expected[i - 1]]) === normalizeWord(actual[j - 1])
      ) {
        dp[i][j] = Math.max(dp[i][j], dp[i - 2][j - 1] + 2);
      }

      if (
        j >= 2 &&
        normalizeWord(expected[i - 1]) === joinWords([actual[j - 2], actual[j - 1]])
      ) {
        dp[i][j] = Math.max(dp[i][j], dp[i - 1][j - 2] + 1);
      }
    }
  }

  // Backtrack with the same merged/split rules.
  const tokens: DiffToken[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      normalizeWord(expected[i - 1]) === normalizeWord(actual[j - 1]) &&
      dp[i][j] === dp[i - 1][j - 1] + 1
    ) {
      tokens.push({ type: "match", word: actual[j - 1], count: 1 });
      i--;
      j--;
    } else if (
      i >= 2 &&
      j > 0 &&
      joinWords([expected[i - 2], expected[i - 1]]) === normalizeWord(actual[j - 1]) &&
      dp[i][j] === dp[i - 2][j - 1] + 2
    ) {
      tokens.push({ type: "match", word: actual[j - 1], count: 2 });
      i -= 2;
      j -= 1;
    } else if (
      i > 0 &&
      j >= 2 &&
      normalizeWord(expected[i - 1]) === joinWords([actual[j - 2], actual[j - 1]]) &&
      dp[i][j] === dp[i - 1][j - 2] + 1
    ) {
      tokens.push({
        type: "match",
        word: `${actual[j - 2]} ${actual[j - 1]}`,
        count: 1,
      });
      i -= 1;
      j -= 2;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.push({ type: "extra", word: actual[j - 1] });
      j--;
    } else {
      tokens.push({ type: "missing", word: expected[i - 1] });
      i--;
    }
  }
  tokens.reverse();
  return tokens;
}

export function FollowAlongInlineDiff({
  expectedText,
  transcript,
  score,
}: FollowAlongInlineDiffProps) {
  if (!transcript) return null;

  const expectedWords = expectedText.split(/\s+/).filter(Boolean);
  const actualWords = transcript.split(/\s+/).filter(Boolean);
  const tokens = diffWords(expectedWords, actualWords);

  return (
    <div className="mt-2 rounded-xl border border-yellow-200/60 bg-yellow-50/80 px-3 py-2 text-left text-sm leading-relaxed">
      <div className="text-left leading-relaxed">
        {tokens.map((tok, i) => {
          switch (tok.type) {
            case "match":
              return (
                <span key={i} className="font-bold text-emerald-600">
                  {i > 0 ? " " : ""}{tok.word}
                </span>
              );
            case "extra":
              return (
                <span key={i} className="font-bold text-red-500">
                  {i > 0 ? " " : ""}{tok.word}
                </span>
              );
            case "missing":
              return (
                <span key={i} className="italic text-gray-400">
                  {i > 0 ? " " : ""}({tok.word})
                </span>
              );
          }
        })}
      </div>
      {score !== null && (
        <div className="mt-1.5 text-left text-xs font-bold text-gray-600">
          {score >= 0.8
            ? "🌟 Great job!"
            : score >= 0.5
              ? "👍 Good try!"
              : "💪 Keep practicing!"}
          {" "}
          ({Math.round(score * 100)}% match)
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Follow-along logic hook (extracted from FollowAlongChallenge)     */
/* ------------------------------------------------------------------ */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function scoreTranscript(expected: string, actual: string): number {
  const normalize = (t: string) =>
    t.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const expWords = normalize(expected);
  const actWords = normalize(actual);
  if (expWords.length === 0 || actWords.length === 0) return 0;

  // Score by in-sequence matches so missing and misplaced words reduce the result.
  const tokens = diffWords(expWords, actWords);
  const matches = tokens.reduce(
    (sum, token) => sum + (token.type === "match" ? token.count : 0),
    0
  );
  return matches / expWords.length;
}

export function useFollowAlong(expectedText: string) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const RecognitionCtor = useMemo(() => getSpeechRecognitionConstructor(), []);
  const isSupported = Boolean(RecognitionCtor);

  // Clear captured text when the focused line changes
  useEffect(() => {
    setTranscript("");
    setScore(null);
  }, [expectedText]);

  const start = () => {
    if (!RecognitionCtor || isListening) return;
    const recognition = new RecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const t = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(t);
      setScore(scoreTranscript(expectedText, t));
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setTranscript("");
    setScore(null);
    setIsListening(true);
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { isListening, transcript, score, isSupported, start, stop };
}
