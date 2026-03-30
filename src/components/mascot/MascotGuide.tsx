"use client";

import React, { useState } from "react";

type MascotMood = "happy" | "encouraging" | "thinking" | "celebrating";

interface MascotGuideProps {
  message: string;
  mood?: MascotMood;
  /** Auto-speak the message using TTS */
  autoSpeak?: boolean;
  /** Make the mascot dismissible */
  dismissible?: boolean;
  onDismiss?: () => void;
}

const MOOD_EMOJIS: Record<MascotMood, string> = {
  happy: "🦉",
  encouraging: "💪🦉",
  thinking: "🤔🦉",
  celebrating: "🎉🦉",
};

export function MascotGuide({
  message,
  mood = "happy",
  autoSpeak = false,
  dismissible = true,
  onDismiss,
}: MascotGuideProps) {
  const [visible, setVisible] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if (!window.speechSynthesis || isSpeaking) return;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.lang = "en-US";

    // Pick a natural-sounding English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      "Samantha (Enhanced)", "Samantha", "Karen (Enhanced)", "Karen",
      "Google UK English Female", "Google US English",
      "Microsoft Aria Online (Natural)", "Microsoft Jenny Online (Natural)",
    ];
    for (const name of preferred) {
      const v = voices.find((voice) => voice.name === name);
      if (v) { utterance.voice = v; break; }
    }
    if (!utterance.voice) {
      const eng = voices.find((v) => v.lang.startsWith("en") && v.default)
        ?? voices.find((v) => v.lang.startsWith("en"));
      if (eng) utterance.voice = eng;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  // Auto-speak on mount
  React.useEffect(() => {
    if (autoSpeak && visible) {
      const timer = setTimeout(handleSpeak, 500);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-50 border-2 border-yellow-200 transition-all duration-300"
      role="status"
      aria-live="polite"
      aria-label={`Lumi says: ${message}`}
    >
      {/* Mascot avatar */}
      <button
        className="text-4xl flex-shrink-0 hover:scale-110 transition-transform cursor-pointer"
        onClick={handleSpeak}
        aria-label="Click Lumi to hear the message"
        title="Click me to hear!"
      >
        <span className={isSpeaking ? "animate-bounce" : ""}>
          {MOOD_EMOJIS[mood]}
        </span>
      </button>

      {/* Speech bubble */}
      <div className="flex-1">
        <p className="text-sm font-medium leading-relaxed">
          {message}
        </p>
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-yellow-200 hover:bg-yellow-300 transition-colors text-yellow-700"
          onClick={handleDismiss}
          aria-label="Dismiss message"
        >
          ✕
        </button>
      )}
    </div>
  );
}
