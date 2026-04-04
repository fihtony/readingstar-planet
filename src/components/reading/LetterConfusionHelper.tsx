"use client";

import React from "react";
import {
  annotateText,
  type TextSegment,
} from "@/lib/letter-confusion";
import type { LetterConfusionConfig } from "@/types";
import { isWindowsBrowser } from "@/lib/platform";

interface LetterConfusionHelperProps {
  text: string;
  config: LetterConfusionConfig;
  activeWordIndex?: number;
}

export function LetterConfusionHelper({
  text,
  config,
  activeWordIndex = -1,
}: LetterConfusionHelperProps) {
  // On Windows, TTS word-boundary timing is inaccurate — skip the highlight.
  const disableHighlight = isWindowsBrowser();
  const effectiveIndex = disableHighlight ? -1 : activeWordIndex;

  if (!config.enabled) {
    return <PlainTextWithHighlight text={text} activeWordIndex={effectiveIndex} />;
  }

  const pieces = text.split(/(\s+)/);

  return (
    <span>
      {pieces.map((piece, pieceIndex) => {
        if (/^\s+$/.test(piece)) {
          return <span key={`space-${pieceIndex}`}>{piece}</span>;
        }

        const segments = annotateText(piece);
        return (
          <span
            key={`piece-${pieceIndex}`}
            className={pieceIndex / 2 === effectiveIndex ? "tts-word-active" : undefined}
          >
            {segments.map((segment, i) => (
              <AnnotatedSegment
                key={`${pieceIndex}-${i}`}
                segment={segment}
                showMnemonics={config.showMnemonics}
                intensity={config.intensity}
              />
            ))}
          </span>
        );
      })}
    </span>
  );
}

function PlainTextWithHighlight({
  text,
  activeWordIndex,
}: {
  text: string;
  activeWordIndex: number;
}) {
  const pieces = text.split(/(\s+)/);
  let wordIndex = -1;

  return (
    <span>
      {pieces.map((piece, index) => {
        if (/^\s+$/.test(piece)) {
          return <span key={`plain-space-${index}`}>{piece}</span>;
        }

        wordIndex += 1;

        return (
          <span
            key={`plain-piece-${index}`}
            className={wordIndex === activeWordIndex ? "tts-word-active" : undefined}
          >
            {piece}
          </span>
        );
      })}
    </span>
  );
}

interface AnnotatedSegmentProps {
  segment: TextSegment;
  showMnemonics: boolean;
  intensity: LetterConfusionConfig["intensity"];
}

function AnnotatedSegment({
  segment,
  showMnemonics,
  intensity,
}: AnnotatedSegmentProps) {
  if (!segment.isConfusable || !segment.letterInfo) {
    return <span>{segment.text}</span>;
  }

  const { letterInfo, text } = segment;
  const showTooltip = showMnemonics && intensity !== "low";
  const isBold = intensity === "high" || intensity === "medium";
  const accentShadow = intensity === "high"
    ? `0 0 0.01em ${letterInfo.colorHex}`
    : undefined;

  return (
    <span
      className={`${letterInfo.colorClass} relative`}
      style={{
        fontWeight: isBold ? "bold" : "normal",
        display: "inline",
        fontSize: "1em",
        lineHeight: "inherit",
        letterSpacing: "inherit",
        verticalAlign: "baseline",
        textShadow: accentShadow,
        transition: "all 0.2s ease",
      }}
      role="mark"
      aria-label={`Letter ${text}, colored ${letterInfo.colorClass.replace("letter-", "")}`}
      title={showTooltip ? letterInfo.mnemonic : undefined}
    >
      {text}
    </span>
  );
}
