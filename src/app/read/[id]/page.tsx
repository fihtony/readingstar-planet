"use client";

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
import { TTSCompanion } from "@/components/reading/TTSCompanion";
import { LetterDetectiveGame } from "@/components/reading/LetterDetectiveGame";
import { FollowAlongChallenge } from "@/components/reading/FollowAlongChallenge";
import { ReadingToolbar } from "@/components/reading/ReadingToolbar";
import { BreakReminder } from "@/components/reading/BreakReminder";
import { MascotGuide } from "@/components/mascot/MascotGuide";
import { useReadingFocus } from "@/hooks/useReadingFocus";
import { useTTS } from "@/hooks/useTTS";
import { useLetterConfusion } from "@/hooks/useLetterConfusion";
import { parseReadingContent, splitIntoWords } from "@/lib/text-processor";
import type { Document, FontFamily, ParsedDocument } from "@/types";

const DEFAULT_USER_ID = "default-user";

export default function ReadPage() {
  const mascot = useTranslations("mascot");
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
  const [ttsPitch, setTtsPitch] = useState(1.05);
  const [ttsVoice, setTtsVoice] = useState("");

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
        const response = await fetch("/api/reading-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
    readingFocus.mode,
    letterConfusion.config.enabled,
    hasUsedTTS,
  ]);

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
  }, [sessionId]);

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

  const currentLineText = document.lines[readingFocus.currentLine] || "";

  return (
    <div className="flex flex-col gap-4">
      <BreakReminder active={!loading && !!document} />
      <h1
        className="text-xl font-bold"
        style={{ color: "var(--color-warm-orange)" }}
      >
        📖 {document.title}
      </h1>

      <MascotGuide
        message={mascot("readingStart")}
        mood="happy"
      />

      <ReadingToolbar
        focusMode={readingFocus.mode}
        theme={readingFocus.theme}
        letterHelperEnabled={letterConfusion.config.enabled}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        maskOpacity={readingFocus.maskOpacity}
        onFocusModeChange={readingFocus.setMode}
        onThemeChange={readingFocus.setTheme}
        onLetterHelperToggle={letterConfusion.toggle}
        onOpenLetterDetective={() => setIsDetectiveOpen(true)}
        onFontSizeChange={setFontSize}
        onLineSpacingChange={setLineSpacing}
        onMaskOpacityChange={readingFocus.setMaskOpacity}
      />

      <TTSCompanion
        isPlaying={tts.isPlaying}
        isPaused={tts.isPaused}
        currentWordIndex={tts.currentWordIndex}
        speed={tts.speed}
        isSupported={tts.isSupported}
        onPlay={handleTTSPlay}
        onPause={tts.pause}
        onResume={tts.resume}
        onStop={tts.stop}
        onSpeedChange={tts.setSpeed}
        text={currentLineText}
      />

      <FollowAlongChallenge text={currentLineText} />

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
        ⬆️ ⬇️ Arrow keys to navigate • Space to play/pause • Click a line to jump
      </p>

      {isDetectiveOpen ? (
        <LetterDetectiveGame
          text={document.lines.join(" ")}
          onClose={() => setIsDetectiveOpen(false)}
        />
      ) : null}
    </div>
  );
}
