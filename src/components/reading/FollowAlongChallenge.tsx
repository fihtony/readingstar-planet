"use client";

import React, { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

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
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreTranscript(expected: string, actual: string): number {
  const expectedWords = normalizeWords(expected);
  const actualWords = normalizeWords(actual);

  if (expectedWords.length === 0 || actualWords.length === 0) {
    return 0;
  }

  const matches = expectedWords.filter((word, index) => actualWords[index] === word).length;
  return matches / expectedWords.length;
}

interface FollowAlongChallengeProps {
  text: string;
}

export function FollowAlongChallenge({ text }: FollowAlongChallengeProps) {
  const t = useTranslations("reading.tts");
  const feedback = useTranslations("feedback");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const RecognitionCtor = useMemo(() => getSpeechRecognitionConstructor(), []);
  const isSupported = Boolean(RecognitionCtor);

  const startChallenge = () => {
    if (!RecognitionCtor || isListening) {
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const nextTranscript = event.results[0]?.[0]?.transcript ?? "";
      const score = scoreTranscript(text, nextTranscript);
      setTranscript(nextTranscript);
      setResultMessage(score >= 0.6 ? feedback("great") : feedback("tryAgain"));
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setResultMessage("");
    setIsListening(true);
    recognition.start();
  };

  const stopChallenge = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-sm text-yellow-900">{t("followAlong")}</h2>
          <p className="text-sm text-yellow-800">Listen, then read the line back in your own voice.</p>
        </div>
        {isListening ? (
          <Button variant="ghost" size="sm" onClick={stopChallenge}>
            Stop
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={startChallenge}>
            {t("followAlong")}
          </Button>
        )}
      </div>

      {transcript ? (
        <p className="mt-3 text-sm text-gray-700">
          <strong>You said:</strong> {transcript}
        </p>
      ) : null}

      {resultMessage ? (
        <p className="mt-2 text-sm font-medium text-gray-800">{resultMessage}</p>
      ) : null}
    </div>
  );
}