"use client";

import Image from "next/image";
import Link from "next/link";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ReadingFocusMode } from "@/components/reading/ReadingFocusMode";
import { LetterConfusionHelper } from "@/components/reading/LetterConfusionHelper";
import { LetterDetectiveGame } from "@/components/reading/LetterDetectiveGame";
import { BreakReminder } from "@/components/reading/BreakReminder";
import { MascotGuide } from "@/components/mascot/MascotGuide";
import { SettingsPanel } from "@/components/reading/SettingsPanel";
import { FloatingControls, FollowAlongInlineDiff, useFollowAlong } from "@/components/reading/FloatingControls";
import { useReadingFocus } from "@/hooks/useReadingFocus";
import { useTTS } from "@/hooks/useTTS";
import { useLetterConfusion } from "@/hooks/useLetterConfusion";
import { parseReadingContent, splitIntoWords } from "@/lib/text-processor";
import {
  getReadCountCooldownMsForContent,
  markReadCounted,
  shouldCountReadOnRefresh,
} from "@/lib/read-count";
import type { Document, FontFamily, ParsedDocument, ReadingTheme } from "@/types";

const DEFAULT_USER_ID = "default-user";
const SESSION_BOOTSTRAP_PREFIX = "reading-session-bootstrap:";

export default function ReadPage() {
  const mascot = useTranslations("mascot");
  const nav = useTranslations("nav");
  const reading = useTranslations("reading");
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontFamily, setFontFamily] = useState<FontFamily>("opendyslexic");
  const [fontSize, setFontSize] = useState(20);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasUsedTTS, setHasUsedTTS] = useState(false);
  const [isDetectiveOpen, setIsDetectiveOpen] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [ttsPitch, setTtsPitch] = useState(1.05);
  const [ttsVoice, setTtsVoice] = useState("");
  const [readCountCooldownMs, setReadCountCooldownMs] = useState<number | null>(null);
  const sessionBootstrapIdRef = useRef<string | null>(null);

  const readingFocus = useReadingFocus({
    totalLines: document?.lines.length ?? 0,
  });

  const tts = useTTS({
    pitch: ttsPitch,
    voiceName: ttsVoice,
    onEnd: () => {
      if (readingFocus.mode === "karaoke") {
        readingFocus.nextLine();
      }
    },
  });

  const letterConfusion = useLetterConfusion();
  const latestSessionState = useRef({
    currentLine: 0,
    focusMode: readingFocus.mode,
    letterHelperEnabled: letterConfusion.config.enabled,
    ttsUsed: false,
  });

  useEffect(() => {
    latestSessionState.current = {
      currentLine: readingFocus.currentLine,
      focusMode: readingFocus.mode,
      letterHelperEnabled: letterConfusion.config.enabled,
      ttsUsed: hasUsedTTS,
    };
  }, [
    readingFocus.currentLine,
    readingFocus.mode,
    letterConfusion.config.enabled,
    hasUsedTTS,
  ]);

  useEffect(() => {
    const load = async () => {
      try {
        const [docRes, settingsRes, progressRes] = await Promise.all([
          fetch(`/api/documents?id=${documentId}`),
          fetch(`/api/settings?userId=${DEFAULT_USER_ID}`),
          fetch(
            `/api/reading-progress?userId=${DEFAULT_USER_ID}&documentId=${documentId}`
          ),
        ]);

        if (docRes.ok) {
          const data = await docRes.json();
          const doc = data.document as Document;
          const parsedContent = parseReadingContent(doc.content);

          setReadCountCooldownMs(getReadCountCooldownMsForContent(doc.content));

          setDocument({
            id: doc.id,
            title: doc.title,
            lines: parsedContent.lines,
            paragraphs: parsedContent.paragraphs,
            paragraphStartIndices: parsedContent.paragraphStartIndices,
            leadingWhitespaceByIndex: parsedContent.leadingWhitespaceByIndex,
            readingParagraphs: parsedContent.readingParagraphs,
          });
        }

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setFontFamily(data.settings.fontFamily);
          setFontSize(data.settings.fontSize);
          setLineSpacing(data.settings.lineSpacing);
          readingFocus.setMaskOpacity(data.settings.maskOpacity);
          readingFocus.setTheme(data.settings.theme);
          tts.setSpeed(data.settings.ttsSpeed);
          setTtsPitch(data.settings.ttsPitch);
          setTtsVoice(data.settings.ttsVoice ?? "");
          if (data.settings.ttsVoice) {
            tts.setVoice(data.settings.ttsVoice);
          }
        }

        if (progressRes.ok) {
          const data = await progressRes.json();
          if (data.progress) {
            readingFocus.goToLine(data.progress.currentLine);
          }
        }
      } catch {
        // Keep the local defaults when hydration fails.
      } finally {
        setSettingsReady(true);
        setLoading(false);
      }
    };

    load();
  }, [
    documentId,
    readingFocus.goToLine,
    readingFocus.setMaskOpacity,
    readingFocus.setTheme,
    tts.setSpeed,
  ]);

  useEffect(() => {
    if (!document || sessionId) {
      return;
    }

    let cancelled = false;

    const startSession = async () => {
      try {
        if (typeof window !== "undefined" && !sessionBootstrapIdRef.current) {
          const storageKey = `${SESSION_BOOTSTRAP_PREFIX}${documentId}`;
          const existing = window.sessionStorage.getItem(storageKey);
          const bootstrapId = existing ?? crypto.randomUUID();
          window.sessionStorage.setItem(storageKey, bootstrapId);
          sessionBootstrapIdRef.current = bootstrapId;
        }

        const response = await fetch("/api/reading-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionBootstrapIdRef.current,
            userId: DEFAULT_USER_ID,
            documentId,
            focusMode: readingFocus.mode,
            letterHelperEnabled: letterConfusion.config.enabled,
            ttsUsed: hasUsedTTS,
          }),
        });

        if (!response.ok || cancelled) {
          return;
        }

        const data = await response.json();
        setSessionId(data.session.id);
      } catch {
        // Best-effort tracking only.
      }
    };

    startSession();

    return () => {
      cancelled = true;
    };
  }, [
    document,
    documentId,
    sessionId,
  ]);

  useEffect(() => {
    if (
      !documentId ||
      readCountCooldownMs === null ||
      !shouldCountReadOnRefresh(documentId, readCountCooldownMs)
    ) {
      return;
    }

    let cancelled = false;

    const incrementReadCount = async () => {
      try {
        const response = await fetch("/api/documents", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "increment-read-count",
            documentId,
          }),
        });

        if (!response.ok || cancelled) {
          return;
        }

        markReadCounted(documentId);
      } catch {
        // Ignore refresh read-count failures.
      }
    };

    void incrementReadCount();

    return () => {
      cancelled = true;
    };
  }, [documentId, readCountCooldownMs]);

  useEffect(() => {
    if (!document) {
      return;
    }

    void fetch("/api/reading-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: DEFAULT_USER_ID,
        documentId,
        currentLine: readingFocus.currentLine,
        totalLines: document.lines.length,
      }),
    });
  }, [document, documentId, readingFocus.currentLine]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    void fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: DEFAULT_USER_ID,
        fontFamily,
        fontSize,
        lineSpacing,
        maskOpacity: readingFocus.maskOpacity,
        ttsSpeed: tts.speed,
        theme: readingFocus.theme,
      }),
    });
  }, [
    settingsReady,
    fontFamily,
    fontSize,
    lineSpacing,
    readingFocus.maskOpacity,
    readingFocus.theme,
    tts.speed,
  ]);

  useEffect(() => {
    return () => {
      if (!sessionId) {
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`${SESSION_BOOTSTRAP_PREFIX}${documentId}`);
      }

      const finalState = latestSessionState.current;

      void fetch("/api/reading-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          linesRead: finalState.currentLine + 1,
          focusMode: finalState.focusMode,
          letterHelperEnabled: finalState.letterHelperEnabled,
          ttsUsed: finalState.ttsUsed,
        }),
        keepalive: true,
      });
    };
  }, [documentId, sessionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          readingFocus.nextLine();
          break;
        case "ArrowUp":
        case "k":
          event.preventDefault();
          readingFocus.prevLine();
          break;
        case " ":
          event.preventDefault();
          if (tts.isPlaying) {
            tts.isPaused ? tts.resume() : tts.pause();
          } else if (document) {
            const currentText = document.lines[readingFocus.currentLine] || "";
            setHasUsedTTS(true);
            tts.speak(currentText, splitIntoWords(currentText));
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readingFocus, tts, document]);

  const handleLineClick = useCallback(
    (index: number) => {
      readingFocus.goToLine(index);
    },
    [readingFocus]
  );

  const handleTTSPlay = useCallback(
    (text: string, words: string[]) => {
      setHasUsedTTS(true);
      tts.speak(text, words);
    },
    [tts]
  );

  // Must be called unconditionally — before any early returns
  const currentLineText = document?.lines[readingFocus.currentLine] ?? "";
  const followAlong = useFollowAlong(currentLineText);
  const themeOptions: {
    value: ReadingTheme;
    label: string;
    icon: string;
    activeClassName: string;
  }[] = [
    {
      value: "flashlight",
      label: reading("themes.flashlight"),
      icon: "🔦",
      activeClassName: "border-amber-300 bg-amber-100 text-amber-800 shadow-[0_6px_18px_rgba(245,158,11,0.22)]",
    },
    {
      value: "magnifier",
      label: reading("themes.magnifier"),
      icon: "🔍",
      activeClassName: "border-sky-300 bg-sky-100 text-sky-700 shadow-[0_6px_18px_rgba(14,165,233,0.18)]",
    },
    {
      value: "magic-wand",
      label: reading("themes.magicWand"),
      icon: "✨",
      activeClassName: "border-lime-300 bg-lime-100 text-lime-800 shadow-[0_6px_18px_rgba(132,204,22,0.2)]",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-bounce">🦉</div>
        <p className="ml-3 text-lg">Lumi is opening your book...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <MascotGuide
        message="Hmm, I couldn't find that book. Let's go back to the library!"
        mood="thinking"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <BreakReminder active={!loading && !!document} />

      <div className="flex items-center gap-4">
        <Link
          href="/library"
          aria-label={nav("library")}
          title={nav("library")}
          className="group relative flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 rounded-md"
        >
          <Image
            src="/images/back_off.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain opacity-100 transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0"
          />
          <Image
            src="/images/back_lit.png"
            alt=""
            width={32}
            height={32}
            className="absolute h-8 w-8 object-contain opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
          <span className="sr-only">{nav("library")}</span>
        </Link>

        <h1
          className="min-w-0 flex-1 text-xl font-bold leading-tight sm:text-2xl"
          style={{ color: "var(--color-warm-orange)" }}
        >
          📖 {document.title}
        </h1>

        <span
          className="shrink-0 select-none text-2xl leading-none"
          aria-label={`${reading("settings.theme")}: ${themeOptions.find((t) => t.value === readingFocus.theme)?.label ?? ""}`}
          title={themeOptions.find((t) => t.value === readingFocus.theme)?.label}
          aria-live="polite"
        >
          {themeOptions.find((t) => t.value === readingFocus.theme)?.icon ?? "🔦"}
        </span>
      </div>

      <div
        className="p-6 rounded-2xl bg-white shadow-sm border border-gray-100 min-h-[400px]"
        style={{
          fontFamily:
            fontFamily === "system"
              ? "system-ui, -apple-system, sans-serif"
              : '"OpenDyslexic", system-ui, -apple-system, sans-serif',
        }}
      >
        <ReadingFocusMode
          lines={document.lines}
          readingParagraphs={document.readingParagraphs}
          currentLine={readingFocus.currentLine}
          mode={readingFocus.mode}
          theme={readingFocus.theme}
          maskOpacity={readingFocus.maskOpacity}
          fontSize={fontSize}
          lineSpacing={lineSpacing}
          isLineVisible={readingFocus.isLineVisible}
          isLineFocused={readingFocus.isLineFocused}
          onLineClick={handleLineClick}
          focusedLineExtra={
            followAlong.transcript ? (
              <FollowAlongInlineDiff
                expectedText={currentLineText}
                transcript={followAlong.transcript}
                score={followAlong.score}
              />
            ) : undefined
          }
          renderLine={(line, index) => {
            const isCurrent = index === readingFocus.currentLine && tts.isPlaying;

            return (
              <LetterConfusionHelper
                text={line}
                config={letterConfusion.config}
                activeWordIndex={isCurrent ? tts.currentWordIndex : -1}
              />
            );
          }}
        />
      </div>

      <p className="text-center text-xs text-gray-400">
        ⬆️ ⬇️ Arrow keys to navigate • Space to play/pause • Click a paragraph to jump
      </p>

      {/* Floating control bar: TTS + Follow Along */}
      <FloatingControls
        ttsSupported={tts.isSupported}
        ttsPlaying={tts.isPlaying}
        ttsPaused={tts.isPaused}
        currentText={currentLineText}
        onTtsPlay={handleTTSPlay}
        onTtsPause={tts.pause}
        onTtsResume={tts.resume}
        onTtsStop={tts.stop}
        followAlongActive={followAlong.isListening}
        onFollowAlongStart={followAlong.start}
        onFollowAlongStop={followAlong.stop}
        followAlongSupported={followAlong.isSupported}
      />

      {/* Slide-out settings panel from right */}
      <SettingsPanel
        open={settingsPanelOpen}
        onOpen={() => setSettingsPanelOpen(true)}
        onClose={() => setSettingsPanelOpen(false)}
        hintMessage={mascot("readingStart")}
        focusMode={readingFocus.mode}
        theme={readingFocus.theme}
        letterHelperEnabled={letterConfusion.config.enabled}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        maskOpacity={readingFocus.maskOpacity}
        ttsSpeed={tts.speed}
        onFocusModeChange={readingFocus.setMode}
        onThemeChange={readingFocus.setTheme}
        onLetterHelperToggle={letterConfusion.toggle}
        onOpenLetterDetective={() => setIsDetectiveOpen(true)}
        onFontSizeChange={setFontSize}
        onLineSpacingChange={setLineSpacing}
        onMaskOpacityChange={readingFocus.setMaskOpacity}
        onTtsSpeedChange={tts.setSpeed}
      />

      {isDetectiveOpen ? (
        <LetterDetectiveGame
          text={document.lines.join(" ")}
          onClose={() => setIsDetectiveOpen(false)}
        />
      ) : null}
    </div>
  );
}
