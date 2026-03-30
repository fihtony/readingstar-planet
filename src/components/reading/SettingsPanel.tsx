"use client";

import Image from "next/image";
import React from "react";
import { useTranslations } from "next-intl";
import type { FocusMode, ReadingTheme } from "@/types";

interface SettingsPanelProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  hintMessage?: string;
  focusMode: FocusMode;
  theme: ReadingTheme;
  letterHelperEnabled: boolean;
  fontSize: number;
  lineSpacing: number;
  maskOpacity: number;
  ttsSpeed: number;
  onFocusModeChange: (mode: FocusMode) => void;
  onThemeChange: (theme: ReadingTheme) => void;
  onLetterHelperToggle: () => void;
  onOpenLetterDetective: () => void;
  onFontSizeChange: (size: number) => void;
  onLineSpacingChange: (spacing: number) => void;
  onMaskOpacityChange: (opacity: number) => void;
  onTtsSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: "🐢 0.5x" },
  { value: 0.6, label: "🐢 0.6x" },
  { value: 0.8, label: "🚶 0.8x" },
  { value: 1.0, label: "🚶 1.0x" },
  { value: 1.2, label: "🏃 1.2x" },
  { value: 1.5, label: "🏃 1.5x" },
  { value: 2.0, label: "🚀 2.0x" },
];

const THEME_BUBBLE_STYLES: Record<ReadingTheme, { container: string; tail: string }> = {
  flashlight: {
    container: "bg-amber-50/95 border-amber-200 text-amber-900",
    tail: "border-amber-200 bg-amber-50",
  },
  magnifier: {
    container: "bg-sky-50/95 border-sky-200 text-sky-900",
    tail: "border-sky-200 bg-sky-50",
  },
  "magic-wand": {
    container: "bg-lime-50/95 border-lime-200 text-lime-900",
    tail: "border-lime-200 bg-lime-50",
  },
};

export function SettingsPanel({
  open,
  onOpen,
  onClose,
  hintMessage,
  focusMode,
  theme,
  letterHelperEnabled,
  fontSize,
  lineSpacing,
  maskOpacity,
  ttsSpeed,
  onFocusModeChange,
  onThemeChange,
  onLetterHelperToggle,
  onOpenLetterDetective,
  onFontSizeChange,
  onLineSpacingChange,
  onMaskOpacityChange,
  onTtsSpeedChange,
}: SettingsPanelProps) {
  const t = useTranslations("reading");
  const [showHint, setShowHint] = React.useState(true);
  const themeBubble = THEME_BUBBLE_STYLES[theme];

  const focusModes: { value: FocusMode; label: string; icon: string; desc: string }[] = [
    { value: "single-line", label: t("focusMode.singleLine"), icon: "🔦", desc: "One line at a time" },
    { value: "sliding-window", label: t("focusMode.slidingWindow"), icon: "🪟", desc: "±1 line context" },
    { value: "karaoke", label: t("focusMode.karaoke"), icon: "🎤", desc: "Word-by-word glow with TTS" },
  ];

  const themes: { value: ReadingTheme; label: string; icon: string }[] = [
    { value: "flashlight", label: t("themes.flashlight"), icon: "🔦" },
    { value: "magnifier", label: t("themes.magnifier"), icon: "🔍" },
    { value: "magic-wand", label: t("themes.magicWand"), icon: "✨" },
  ];

  return (
    <>
      {/* Right-edge owl tab — visible only when panel is closed */}
      {!open && (
        <>
          {/* Transparent dismiss layer — click anywhere outside bubble to dismiss greeting */}
          {showHint && hintMessage && (
            <div
              className="fixed inset-0 z-[54]"
              onClick={() => setShowHint(false)}
              aria-hidden="true"
            />
          )}

          {/* Owl + bubble container: 3px off-screen by default, full on hover or while greeting is visible */}
          <div
            className={`fixed right-0 top-1/3 z-[55] -translate-y-1/2 flex items-start transition-transform duration-200 ease-in-out ${
              showHint && hintMessage ? "translate-x-0" : "translate-x-[3px] hover:translate-x-0"
            }`}
          >
            {/* Greeting bubble — shown on entry, click outside to dismiss */}
            {showHint && hintMessage && (
              <div
                className={`relative mr-3 mt-6 w-[220px] rounded-2xl border px-4 py-3 text-left text-sm font-medium leading-relaxed shadow-lg backdrop-blur-sm ${themeBubble.container}`}
                onClick={(e) => e.stopPropagation()}
              >
                {hintMessage}
                <span
                  className={`absolute -right-[6px] top-4 h-3 w-3 rotate-45 border-r border-b ${themeBubble.tail}`}
                  aria-hidden="true"
                />
              </div>
            )}

            {/* Owl button — click to open settings panel */}
            <button
              onClick={() => { setShowHint(false); onOpen(); }}
              className="block"
              aria-label="Open settings"
              title="Open settings"
            >
              <Image
                src="/images/owl-slidemenu.png"
                alt=""
                width={88}
                height={149}
                priority
                className="block h-auto w-[88px] max-w-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.14)]"
              />
            </button>
          </div>
        </>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-[340px] max-w-[85vw] transform bg-white shadow-[-8px_0_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal={open}
        aria-label="Reading settings"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-lg font-black text-slate-800">⚙️ {t("title")} Settings</h2>
            <button
              onClick={onClose}
              className="btn-kid flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Focus Mode */}
            <SettingsSection title={t("focusMode.label")}>
              <div className="space-y-2">
                {focusModes.map((m) => (
                  <button
                    key={m.value}
                    className={`btn-kid flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm ${
                      focusMode === m.value
                        ? "border-2 border-sky-300 bg-sky-50 text-sky-700"
                        : "border-2 border-transparent bg-gray-50 text-gray-600"
                    }`}
                    onClick={() => onFocusModeChange(m.value)}
                    aria-pressed={focusMode === m.value}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <div>
                      <div className="font-bold">{m.label}</div>
                      <div className="text-xs text-gray-500">{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </SettingsSection>

            {/* Theme */}
            <SettingsSection title={t("settings.theme")}>
              <div className="flex gap-2">
                {themes.map((themeOption) => (
                  <button
                    key={themeOption.value}
                    className={`btn-kid flex-1 rounded-2xl px-3 py-3 text-center text-sm ${
                      theme === themeOption.value
                        ? "border-2 border-orange-300 bg-orange-50 text-orange-700"
                        : "border-2 border-transparent bg-gray-50 text-gray-600"
                    }`}
                    onClick={() => onThemeChange(themeOption.value)}
                    aria-pressed={theme === themeOption.value}
                  >
                    <div className="text-xl">{themeOption.icon}</div>
                    <div className="mt-1 text-xs font-bold">{themeOption.label}</div>
                  </button>
                ))}
              </div>
            </SettingsSection>

            {/* Letter Helper */}
            <SettingsSection title={t("letterHelper.label")}>
              <div className="flex gap-2">
                <button
                  className={`btn-kid flex-1 rounded-2xl px-4 py-3 text-sm font-bold ${
                    letterHelperEnabled
                      ? "border-2 border-blue-300 bg-blue-50 text-blue-700"
                      : "border-2 border-transparent bg-gray-50 text-gray-600"
                  }`}
                  onClick={onLetterHelperToggle}
                  aria-pressed={letterHelperEnabled}
                >
                  🔤 {letterHelperEnabled ? t("letterHelper.on") : t("letterHelper.off")}
                </button>
                <button
                  className="btn-kid flex-1 rounded-2xl border-2 border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-800"
                  onClick={() => { onOpenLetterDetective(); onClose(); }}
                >
                  🕵️ {t("letterHelper.detective")}
                </button>
              </div>
            </SettingsSection>

            {/* TTS Speed */}
            <SettingsSection title="Reading Speed">
              <div className="flex flex-wrap gap-2">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    className={`btn-kid rounded-xl px-3 py-2 text-sm ${
                      ttsSpeed === s.value
                        ? "border-2 border-sky-300 bg-sky-50 font-bold text-sky-700"
                        : "border-2 border-transparent bg-gray-50 text-gray-600"
                    }`}
                    onClick={() => onTtsSpeedChange(s.value)}
                    aria-pressed={ttsSpeed === s.value}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </SettingsSection>

            {/* Font Size */}
            <SettingsSection title={t("settings.fontSize")}>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">A</span>
                <input
                  type="range"
                  min={14}
                  max={32}
                  value={fontSize}
                  onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
                  className="flex-1"
                  aria-label="Font size"
                />
                <span className="text-lg text-gray-600 font-bold">A</span>
                <span className="w-12 text-right text-sm text-gray-500">{fontSize}px</span>
              </div>
            </SettingsSection>

            {/* Line Spacing */}
            <SettingsSection title={t("settings.lineSpacing")}>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">≡</span>
                <input
                  type="range"
                  min={1.5}
                  max={2.5}
                  step={0.1}
                  value={lineSpacing}
                  onChange={(e) => onLineSpacingChange(parseFloat(e.target.value))}
                  className="flex-1"
                  aria-label="Line spacing"
                />
                <span className="w-10 text-right text-sm text-gray-500">{lineSpacing.toFixed(1)}</span>
              </div>
            </SettingsSection>

            {/* Mask Opacity */}
            <SettingsSection title={t("settings.maskOpacity")}>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">☀️</span>
                <input
                  type="range"
                  min={0}
                  max={0.9}
                  step={0.1}
                  value={maskOpacity}
                  onChange={(e) => onMaskOpacityChange(parseFloat(e.target.value))}
                  className="flex-1"
                  aria-label="Mask darkness"
                />
                <span className="text-xs text-gray-400">🌙</span>
                <span className="w-10 text-right text-sm text-gray-500">{Math.round(maskOpacity * 100)}%</span>
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>
    </>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </div>
  );
}
