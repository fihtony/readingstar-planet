"use client";

import React, { useRef, useEffect } from "react";
import type { FocusMode, ReadingTheme, ReadingParagraphData } from "@/types";

interface ReadingFocusModeProps {
  lines: string[];
  readingParagraphs?: ReadingParagraphData[];
  currentLine: number;
  mode: FocusMode;
  theme: ReadingTheme;
  maskOpacity: number;
  fontSize: number;
  lineSpacing: number;
  isLineVisible: (index: number) => boolean;
  isLineFocused: (index: number) => boolean;
  onLineClick: (index: number) => void;
  renderLine?: (line: string, index: number) => React.ReactNode;
}

const THEME_EMOJIS: Record<ReadingTheme, string> = {
  flashlight: "🔦",
  magnifier: "🔍",
  "magic-wand": "✨",
};

const THEME_STYLES: Record<
  ReadingTheme,
  {
    containerBackground: string;
    badgeClassName: string;
    focusedBackground: string;
    focusedBorder: string;
    focusedShadow: string;
    focusedTransform: string;
    blurMultiplier: number;
  }
> = {
  flashlight: {
    containerBackground:
      "radial-gradient(circle at top, rgba(255, 230, 109, 0.18), rgba(255, 255, 255, 0.94) 35%, rgba(255, 255, 255, 1) 100%)",
    badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
    focusedBackground: "rgba(255, 230, 109, 0.34)",
    focusedBorder: "1px solid rgba(245, 158, 11, 0.25)",
    focusedShadow: "0 0 0 2px rgba(255, 230, 109, 0.35), 0 10px 24px rgba(245, 158, 11, 0.12)",
    focusedTransform: "none",
    blurMultiplier: 3.4,
  },
  magnifier: {
    containerBackground:
      "linear-gradient(180deg, rgba(224, 242, 254, 0.38), rgba(255, 255, 255, 0.98) 45%)",
    badgeClassName: "bg-sky-50 text-sky-700 border-sky-200",
    focusedBackground: "rgba(186, 230, 253, 0.38)",
    focusedBorder: "1px solid rgba(14, 165, 233, 0.28)",
    focusedShadow: "0 12px 28px rgba(14, 165, 233, 0.16)",
    focusedTransform: "scale(1.02)",
    blurMultiplier: 1.8,
  },
  "magic-wand": {
    containerBackground:
      "linear-gradient(180deg, rgba(254, 249, 195, 0.35), rgba(236, 253, 245, 0.55) 48%, rgba(255, 255, 255, 1) 100%)",
    badgeClassName: "bg-lime-50 text-lime-700 border-lime-200",
    focusedBackground:
      "linear-gradient(90deg, rgba(254, 249, 195, 0.68), rgba(209, 250, 229, 0.72))",
    focusedBorder: "1px solid rgba(132, 204, 22, 0.28)",
    focusedShadow: "0 10px 24px rgba(16, 185, 129, 0.15)",
    focusedTransform: "translateY(-1px)",
    blurMultiplier: 2.4,
  },
};

export function ReadingFocusMode({
  lines,
  readingParagraphs,
  currentLine,
  mode,
  theme,
  maskOpacity,
  fontSize,
  lineSpacing,
  isLineVisible,
  isLineFocused,
  onLineClick,
  renderLine,
}: ReadingFocusModeProps) {
  const themeStyle = THEME_STYLES[theme];
  const focusedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (focusedRef.current && typeof focusedRef.current.scrollIntoView === "function") {
      focusedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentLine]);

  const effectiveParagraphs: ReadingParagraphData[] =
    readingParagraphs ??
    lines.map((line, i) => ({
      indent: "",
      sentences: [line],
      globalStartIndex: i,
    }));

  return (
    <div
      className="reading-container relative w-full rounded-2xl px-3 pb-4 pt-10"
      role="article"
      aria-label="Reading area"
      data-theme={theme}
      data-mode={mode}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: lineSpacing,
        background: themeStyle.containerBackground,
      }}
    >
      {/* Theme indicator */}
      <div
        className={`absolute left-3 top-2 inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-medium ${themeStyle.badgeClassName}`}
        aria-hidden="true"
      >
        {THEME_EMOJIS[theme]}
      </div>

      {effectiveParagraphs.map((para, paraIndex) => {
        const paraHasFocused = para.sentences.some(
          (_, si) => isLineFocused(para.globalStartIndex + si)
        );

        return (
          <div
            key={paraIndex}
            data-paragraph={paraIndex}
            className="relative rounded-xl px-4 py-2 transition-all duration-300"
            style={{
              textIndent:
                para.indent.length > 0
                  ? `${para.indent.length * 0.5}em`
                  : undefined,
              marginTop:
                paraIndex > 0
                  ? `${Math.max(lineSpacing * 0.7, 0.9)}em`
                  : undefined,
              wordBreak: "break-word",
              transform: paraHasFocused
                ? themeStyle.focusedTransform
                : "none",
              boxShadow: paraHasFocused
                ? themeStyle.focusedShadow
                : "none",
              border: paraHasFocused
                ? themeStyle.focusedBorder
                : "1px solid transparent",
            }}
          >
            {para.sentences.map((sentence, si) => {
              const globalIndex = para.globalStartIndex + si;
              const visible = isLineVisible(globalIndex);
              const focused = isLineFocused(globalIndex);

              return (
                <React.Fragment key={si}>
                  {si > 0 && " "}
                  <span
                    ref={focused ? focusedRef : undefined}
                    data-line-index={globalIndex}
                    data-focused={focused ? "true" : "false"}
                    data-visible={visible ? "true" : "false"}
                    role="text"
                    aria-label={`Line ${globalIndex + 1}: ${sentence}`}
                    aria-current={focused ? "true" : undefined}
                    className={`
                      inline rounded-md cursor-pointer transition-all duration-300
                      ${focused ? "reading-line-focused" : ""}
                    `}
                    style={{
                      opacity: visible ? 1 : 1 - maskOpacity,
                      filter: visible
                        ? "none"
                        : `blur(${maskOpacity * themeStyle.blurMultiplier}px)`,
                      pointerEvents: visible ? "auto" : "none",
                      background: focused
                        ? themeStyle.focusedBackground
                        : "transparent",
                      padding: focused ? "1px 3px" : "1px 0",
                      WebkitBoxDecorationBreak: "clone",
                      boxDecorationBreak: "clone",
                    } as React.CSSProperties}
                    onClick={() => onLineClick(globalIndex)}
                  >
                    {renderLine
                      ? renderLine(sentence, globalIndex)
                      : sentence}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        );
      })}

      {/* Progress indicator */}
      <div
        className="mt-4 text-center text-sm"
        style={{ color: "var(--color-sky-blue)" }}
        role="status"
        aria-live="polite"
      >
        {currentLine + 1} / {lines.length}
      </div>
    </div>
  );
}
