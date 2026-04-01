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

function getEstimatedWordDelay(word: string, rate: number) {
  const normalizedRate = Math.max(rate, 0.5);
  const wordLength = word.replace(/[^\p{L}\p{N}'’-]/gu, "").length;
  const punctuationPause = /[.!?]["')\]]*$/.test(word)
    ? 220
    : /[,;:]["')\]]*$/.test(word)
      ? 120
      : 0;
  const baseDelay = 250 + Math.min(wordLength, 12) * 32 + punctuationPause;

  return Math.max(150, Math.round(baseDelay / normalizedRate));
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

  const scheduleWordTrackingFallback = useCallback(
    (wordIndex: number) => {
      clearWordTrackingTimeout();

      const boundaries = wordBoundariesRef.current;
      const nextIndex = wordIndex + 1;
      if (!utteranceRef.current || nextIndex >= boundaries.length) {
        return;
      }

      const delay = getEstimatedWordDelay(
        boundaries[wordIndex]?.text ?? boundaries[nextIndex].text,
        speedRef.current
      );

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

      utterance.onboundary = (event) => {
        if (typeof event.charIndex === "number") {
          const wordIdx = getWordIndexFromCharIndex(
            event.charIndex,
            wordBoundariesRef.current
          );

          if (wordIdx >= 0) {
            updateCurrentWordIndex(wordIdx);
            scheduleWordTrackingFallback(wordIdx);
          }
        }
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
      currentWordIndexRef.current = wordBoundariesRef.current.length > 0 ? 0 : -1;
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentWordIndex: wordBoundariesRef.current.length > 0 ? 0 : -1,
        utterance,
      }));

      window.speechSynthesis.speak(utterance);

      if (wordBoundariesRef.current.length > 0) {
        scheduleWordTrackingFallback(0);
      }
    },
    [clearWordTrackingTimeout, onEnd, scheduleWordTrackingFallback, updateCurrentWordIndex]
  );

  const pause = useCallback(() => {
    clearWordTrackingTimeout();
    window.speechSynthesis?.pause();
    setState((prev) => ({ ...prev, isPaused: true }));
  }, [clearWordTrackingTimeout]);

  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
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
