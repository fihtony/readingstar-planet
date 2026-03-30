"use client";

import { useState, useCallback, useEffect } from "react";
import type { FocusMode, ReadingTheme, ReadingFocusState } from "@/types";

interface UseReadingFocusOptions {
  totalLines: number;
  initialMode?: FocusMode;
  initialTheme?: ReadingTheme;
  initialMaskOpacity?: number;
}

export function useReadingFocus({
  totalLines,
  initialMode = "single-line",
  initialTheme = "flashlight",
  initialMaskOpacity = 0.7,
}: UseReadingFocusOptions) {
  const [state, setState] = useState<ReadingFocusState>({
    mode: initialMode,
    currentLine: 0,
    totalLines,
    maskOpacity: initialMaskOpacity,
    theme: initialTheme,
  });

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      totalLines,
      currentLine: Math.max(
        0,
        Math.min(prev.currentLine, Math.max(totalLines - 1, 0))
      ),
    }));
  }, [totalLines]);

  const goToLine = useCallback(
    (line: number) => {
      setState((prev) => ({
        ...prev,
        currentLine: Math.max(0, Math.min(line, totalLines - 1)),
      }));
    },
    [totalLines]
  );

  const nextLine = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentLine: Math.min(prev.currentLine + 1, totalLines - 1),
    }));
  }, [totalLines]);

  const prevLine = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentLine: Math.max(prev.currentLine - 1, 0),
    }));
  }, []);

  const setMode = useCallback((mode: FocusMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const setTheme = useCallback((theme: ReadingTheme) => {
    setState((prev) => ({ ...prev, theme }));
  }, []);

  const setMaskOpacity = useCallback((maskOpacity: number) => {
    setState((prev) => ({
      ...prev,
      maskOpacity: Math.max(0, Math.min(maskOpacity, 0.9)),
    }));
  }, []);

  /**
   * Determine if a line should be visible based on the current focus mode.
   */
  const isLineVisible = useCallback(
    (lineIndex: number): boolean => {
      switch (state.mode) {
        case "single-line":
          return lineIndex === state.currentLine;
        case "sliding-window":
          return (
            lineIndex >= state.currentLine - 1 &&
            lineIndex <= state.currentLine + 1
          );
        case "karaoke":
          return lineIndex === state.currentLine;
        default:
          return true;
      }
    },
    [state.mode, state.currentLine]
  );

  /**
   * Determine if a line is the actively focused (highlighted) line.
   */
  const isLineFocused = useCallback(
    (lineIndex: number): boolean => {
      return lineIndex === state.currentLine;
    },
    [state.currentLine]
  );

  const isAtStart = state.currentLine === 0;
  const isAtEnd = state.currentLine === totalLines - 1;

  return {
    ...state,
    goToLine,
    nextLine,
    prevLine,
    setMode,
    setTheme,
    setMaskOpacity,
    isLineVisible,
    isLineFocused,
    isAtStart,
    isAtEnd,
  };
}
