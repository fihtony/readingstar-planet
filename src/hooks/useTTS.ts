"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TTSState } from "@/types";

type WordBoundary = {
  text: string;
  start: number;
  end: number;
};

interface UseTTSOptions {
  speed?: number;
  pitch?: number;
  voiceName?: string;
  onWordChange?: (wordIndex: number) => void;
  onLineChange?: (lineIndex: number) => void;
  onEnd?: () => void;
}

/**
 * Preferred voice names ranked by quality for kid-friendly reading.
 * The list covers macOS, Windows, Chrome, and mobile browsers.
 */
const PREFERRED_VOICES = [
  // macOS high-quality voices
  "Samantha (Enhanced)",
  "Samantha",
  "Karen (Enhanced)",
  "Karen",
  "Daniel (Enhanced)",
  "Daniel",
  // Google voices (Chrome)
  "Google UK English Female",
  "Google US English",
  "Google UK English Male",
  // Microsoft voices (Edge / Windows)
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Zira",
  "Microsoft Mark",
];

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  // Try each preferred voice name in order
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name === name);
    if (match) return match;
  }

  // Fallback: find any English voice, prefer ones marked as default or "natural"
  const english = voices.filter((v) => v.lang.startsWith("en"));
  if (english.length > 0) {
    const natural = english.find(
      (v) =>
        v.name.toLowerCase().includes("natural") ||
        v.name.toLowerCase().includes("enhanced")
    );
    if (natural) return natural;

    const defaultVoice = english.find((v) => v.default);
    if (defaultVoice) return defaultVoice;

    return english[0];
  }

  // Last resort: browser default
  return voices.find((v) => v.default) ?? voices[0];
}

function buildWordBoundaries(text: string): WordBoundary[] {
  const boundaries: WordBoundary[] = [];
  const matcher = /\S+/g;

  for (let match = matcher.exec(text); match; match = matcher.exec(text)) {
    boundaries.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return boundaries;
}

function getWordIndexFromCharIndex(charIndex: number, boundaries: WordBoundary[]) {
  if (boundaries.length === 0) {
    return -1;
  }

  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index];

    if (charIndex < boundary.start) {
      return Math.max(0, index - 1);
    }

    if (charIndex < boundary.end) {
      return index;
    }
  }

  return boundaries.length - 1;
}

/**
 * Estimate syllable count for an English word.
 * Used for more accurate per-word TTS duration estimation.
 */
function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 1;
  if (cleaned.length <= 3) return 1;
  let count = (cleaned.match(/[aeiouy]+/g) ?? []).length;
  // Remove trailing silent 'e' (e.g. "make", "come") but preserve syllabic endings
  // like "-le" (table), "-re" (centre), "-ne" (stone is monosyllabic but "-ne" is borderline).
  const lastTwo = cleaned.slice(-2);
  if (cleaned.endsWith("e") && lastTwo !== "le" && count > 1) {
    count--;
  }
  return Math.max(1, count);
}

/**
 * Estimate how long the TTS engine will spend on a word at the given rate.
 * Uses syllable count (~280 ms/syllable at rate=1) rather than character count
 * to give a more accurate base estimate across voices.
 */
function getEstimatedWordDelay(word: string, rate: number): number {
  const normalizedRate = Math.max(rate, 0.5);
  const syllables = countSyllables(word);
  // ~280 ms per syllable at natural speech rate; tuned to ≈120 wpm average
  const syllableMs = 280;
  const punctuationPause = /[.!?]["')\]]*$/.test(word)
    ? 250
    : /[,;:]["')\]]*$/.test(word)
      ? 140
      : /[-\u2014]$/.test(word)
        ? 60
        : 0;
  const baseDelay = Math.max(150, syllables * syllableMs) + punctuationPause;
  return Math.max(100, Math.round(baseDelay / normalizedRate));
}

/**
 * Pre-compute cumulative timestamps (ms from utterance start) for each word.
 * Word i starts at schedule[i] ms after the utterance begins.
 */
function buildWordSchedule(boundaries: WordBoundary[], rate: number): number[] {
  const schedule: number[] = new Array(boundaries.length);
  let cursor = 0;
  for (let i = 0; i < boundaries.length; i++) {
    schedule[i] = cursor;
    cursor += getEstimatedWordDelay(boundaries[i].text, rate);
  }
  return schedule;
}

export function useTTS({
  speed = 0.8,
  pitch = 1.05,
  voiceName = "",
  onWordChange,
  onLineChange,
  onEnd,
}: UseTTSOptions = {}) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentWordIndex: -1,
    speed,
    utterance: null,
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef = useRef<string[]>([]);
  const wordBoundariesRef = useRef<WordBoundary[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speedRef = useRef(speed);
  const pitchRef = useRef(pitch);
  const voiceNameRef = useRef(voiceName);
  const currentWordIndexRef = useRef(-1);
  const wordTrackingTimeoutRef = useRef<number | null>(null);
  // Timing refs for absolute-schedule word tracking
  const utteranceStartTimeRef = useRef<number>(0);
  const wordScheduleRef = useRef<number[]>([]);
  const speechRateCorrectionRef = useRef<number>(1.0);
  const pauseStartTimeRef = useRef<number>(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Keep refs in sync so the speak callback always uses latest values
  useEffect(() => {
    speedRef.current = state.speed;
  }, [state.speed]);

  useEffect(() => {
    currentWordIndexRef.current = state.currentWordIndex;
  }, [state.currentWordIndex]);

  useEffect(() => {
    pitchRef.current = pitch;
  }, [pitch]);

  useEffect(() => {
    voiceNameRef.current = voiceName;
  }, [voiceName]);

  // Load voices and pick the best one
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);

      // If user has a saved voice preference, use it
      if (voiceNameRef.current) {
        const saved = voices.find((v) => v.name === voiceNameRef.current);
        if (saved) {
          voiceRef.current = saved;
          return;
        }
      }
      voiceRef.current = pickBestVoice(voices);
    };

    loadVoices();

    // Voices may load asynchronously in some browsers
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wordTrackingTimeoutRef.current !== null) {
        window.clearTimeout(wordTrackingTimeoutRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const clearWordTrackingTimeout = useCallback(() => {
    if (wordTrackingTimeoutRef.current !== null) {
      window.clearTimeout(wordTrackingTimeoutRef.current);
      wordTrackingTimeoutRef.current = null;
    }
  }, []);

  const updateCurrentWordIndex = useCallback(
    (wordIndex: number) => {
      if (wordIndex < 0) {
        return;
      }

      currentWordIndexRef.current = wordIndex;
      setState((prev) => {
        if (prev.currentWordIndex === wordIndex) {
          return prev;
        }

        return { ...prev, currentWordIndex: wordIndex };
      });
      onWordChange?.(wordIndex);
    },
    [onWordChange]
  );

  /**
   * Schedule the next word advancement using absolute timestamps from the utterance
   * start time. This prevents compounding drift that occurs when timeouts are chained
   * relative to each other — a key fix for Windows Chrome timing inconsistency.
   */
  const scheduleWordTrackingFallback = useCallback(
    (wordIndex: number) => {
      clearWordTrackingTimeout();

      const boundaries = wordBoundariesRef.current;
      const nextIndex = wordIndex + 1;
      if (!utteranceRef.current || nextIndex >= boundaries.length) {
        return;
      }

      // Use absolute target time (utterance start + pre-computed schedule offset)
      // so that small delays in individual timer callbacks don't accumulate.
      const targetMs = utteranceStartTimeRef.current + wordScheduleRef.current[nextIndex];
      const delay = Math.max(50, targetMs - Date.now());

      wordTrackingTimeoutRef.current = window.setTimeout(() => {
        if (!utteranceRef.current || window.speechSynthesis?.paused) {
          return;
        }

        updateCurrentWordIndex(nextIndex);
        scheduleWordTrackingFallback(nextIndex);
      }, delay);
    },
    [clearWordTrackingTimeout, updateCurrentWordIndex]
  );

  const speak = useCallback(
    (text: string, words?: string[]) => {
      if (!window.speechSynthesis) return;

      // Cancel any ongoing speech
      clearWordTrackingTimeout();
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speedRef.current;
      utterance.pitch = pitchRef.current;
      utterance.lang = "en-US";

      // Apply the user-selected or best available voice
      if (voiceNameRef.current) {
        const chosen = window.speechSynthesis
          .getVoices()
          .find((v) => v.name === voiceNameRef.current);
        if (chosen) utterance.voice = chosen;
        else if (voiceRef.current) utterance.voice = voiceRef.current;
      } else if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      }

      wordBoundariesRef.current = buildWordBoundaries(text);
      wordsRef.current =
        words && words.length > 0
          ? words
          : wordBoundariesRef.current.map((boundary) => boundary.text);

      // Build absolute word schedule and reset adaptive correction for fresh utterance
      speechRateCorrectionRef.current = 1.0;
      wordScheduleRef.current = buildWordSchedule(wordBoundariesRef.current, speedRef.current);
      // utteranceStartTimeRef is set in onstart so the schedule is anchored to
      // when the voice actually begins, not when speak() is called. This prevents
      // the word cursor from advancing before speech starts (loading delay).

      utterance.onstart = () => {
        // Anchor the schedule to the moment speech actually begins.
        utteranceStartTimeRef.current = Date.now();
        // Now highlight the first word and start the timer-based fallback.
        if (wordBoundariesRef.current.length > 0) {
          updateCurrentWordIndex(0);
          scheduleWordTrackingFallback(0);
        }
      };

      utterance.onboundary = (event) => {
        if (typeof event.charIndex !== "number") return;

        const wordIdx = getWordIndexFromCharIndex(
          event.charIndex,
          wordBoundariesRef.current
        );
        if (wordIdx < 0) return;

        updateCurrentWordIndex(wordIdx);

        // Adaptive schedule correction: use real boundary event timing to
        // recalibrate remaining word timestamps. This corrects for voices/platforms
        // where the actual speech rate differs from our estimate (e.g. Windows Chrome
        // Microsoft voices vs. macOS Samantha).
        if (wordIdx >= 3) {
          const elapsedMs = Date.now() - utteranceStartTimeRef.current;
          const expectedMs = wordScheduleRef.current[wordIdx];
          // Guard against burst-mode boundary events (all firing at utterance start)
          // which would produce a wildly incorrect correction factor.
          if (expectedMs > 0 && elapsedMs > 200) {
            const rawCorrection = elapsedMs / expectedMs;
            if (rawCorrection > 0.2 && rawCorrection < 5.0) {
              const prev = speechRateCorrectionRef.current;
              const corrected = Math.max(
                0.5,
                Math.min(2.5, prev * 0.6 + rawCorrection * 0.4)
              );
              speechRateCorrectionRef.current = corrected;

              // Re-anchor the schedule from the current word forward using the
              // observed correction factor. This adjusts all future timer delays
              // so they match the actual speaking pace of this voice.
              const bnd = wordBoundariesRef.current;
              const rate = speedRef.current;
              const newSchedule = wordScheduleRef.current.slice(0, wordIdx + 1);
              newSchedule[wordIdx] = elapsedMs; // anchor current word to actual time
              let cursor = elapsedMs;
              for (let i = wordIdx + 1; i < bnd.length; i++) {
                cursor += Math.round(
                  getEstimatedWordDelay(bnd[i - 1].text, rate) * corrected
                );
                newSchedule.push(cursor);
              }
              wordScheduleRef.current = newSchedule;
            }
          }
        }

        scheduleWordTrackingFallback(wordIdx);
      };

      utterance.onend = () => {
        clearWordTrackingTimeout();
        utteranceRef.current = null;
        currentWordIndexRef.current = -1;
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          isPaused: false,
          currentWordIndex: -1,
          utterance: null,
        }));
        onEnd?.();
      };

      utteranceRef.current = utterance;
      currentWordIndexRef.current = -1;
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentWordIndex: -1,
        utterance,
      }));

      window.speechSynthesis.speak(utterance);
    },
    [clearWordTrackingTimeout, onEnd, scheduleWordTrackingFallback, updateCurrentWordIndex]
  );

  const pause = useCallback(() => {
    clearWordTrackingTimeout();
    pauseStartTimeRef.current = Date.now();
    window.speechSynthesis?.pause();
    setState((prev) => ({ ...prev, isPaused: true }));
  }, [clearWordTrackingTimeout]);

  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
    // Shift utterance start time forward by the pause duration so the absolute
    // schedule remains valid after a pause/resume cycle.
    const pauseDuration = Date.now() - pauseStartTimeRef.current;
    utteranceStartTimeRef.current += pauseDuration;
    setState((prev) => ({ ...prev, isPaused: false }));

    if (utteranceRef.current && currentWordIndexRef.current >= 0) {
      scheduleWordTrackingFallback(currentWordIndexRef.current);
    }
  }, [scheduleWordTrackingFallback]);

  const stop = useCallback(() => {
    clearWordTrackingTimeout();
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    currentWordIndexRef.current = -1;
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentWordIndex: -1,
      utterance: null,
    }));
  }, [clearWordTrackingTimeout]);

  const setSpeed = useCallback((newSpeed: number) => {
    const clamped = Math.max(0.5, Math.min(newSpeed, 2.0));
    setState((prev) => ({ ...prev, speed: clamped }));
  }, []);

  const setVoice = useCallback((name: string) => {
    voiceNameRef.current = name;
    const voices = typeof window !== "undefined" ? window.speechSynthesis?.getVoices() ?? [] : [];
    const match = voices.find((v) => v.name === name);
    if (match) voiceRef.current = match;
  }, []);

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return {
    ...state,
    speak,
    pause,
    resume,
    stop,
    setSpeed,
    setVoice,
    availableVoices,
    isSupported,
  };
}
