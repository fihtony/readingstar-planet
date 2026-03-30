"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TTSState } from "@/types";

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
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speedRef = useRef(speed);
  const pitchRef = useRef(pitch);
  const voiceNameRef = useRef(voiceName);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Keep refs in sync so the speak callback always uses latest values
  useEffect(() => {
    speedRef.current = state.speed;
  }, [state.speed]);

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
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string, words?: string[]) => {
      if (!window.speechSynthesis) return;

      // Cancel any ongoing speech
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

      if (words) {
        wordsRef.current = words;
      }

      utterance.onboundary = (event) => {
        if (event.name === "word") {
          // Estimate word index from char offset
          const charIndex = event.charIndex;
          let wordIdx = 0;
          let pos = 0;
          for (let i = 0; i < wordsRef.current.length; i++) {
            if (pos >= charIndex) {
              wordIdx = i;
              break;
            }
            pos += wordsRef.current[i].length + 1; // +1 for space
            wordIdx = i;
          }
          setState((prev) => ({ ...prev, currentWordIndex: wordIdx }));
          onWordChange?.(wordIdx);
        }
      };

      utterance.onend = () => {
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
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentWordIndex: 0,
        utterance,
      }));

      window.speechSynthesis.speak(utterance);
    },
    [onWordChange, onEnd]
  );

  const pause = useCallback(() => {
    window.speechSynthesis?.pause();
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentWordIndex: -1,
      utterance: null,
    }));
  }, []);

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
