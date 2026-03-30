"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FocusMode, ReadingTheme } from "@/types";

interface ReadingToolbarProps {
  focusMode: FocusMode;
  theme: ReadingTheme;
  letterHelperEnabled: boolean;
  fontSize: number;
  lineSpacing: number;
  maskOpacity: number;
  onFocusModeChange: (mode: FocusMode) => void;
  onThemeChange: (theme: ReadingTheme) => void;
  onLetterHelperToggle: () => void;
  onOpenLetterDetective: () => void;
  onFontSizeChange: (size: number) => void;
  onLineSpacingChange: (spacing: number) => void;
  onMaskOpacityChange: (opacity: number) => void;
}

export function ReadingToolbar({
  focusMode,
  theme,
  letterHelperEnabled,
  fontSize,
  lineSpacing,
  maskOpacity,
  onFocusModeChange,
  onThemeChange,
  onLetterHelperToggle,
  onOpenLetterDetective,
  onFontSizeChange,
  onLineSpacingChange,
  onMaskOpacityChange,
}: ReadingToolbarProps) {
  const t = useTranslations("reading");
  const focusModes: { value: FocusMode; label: string; icon: string }[] = [
    { value: "single-line", label: t("focusMode.singleLine"), icon: "🔦" },
    { value: "sliding-window", label: t("focusMode.slidingWindow"), icon: "🪟" },
    { value: "karaoke", label: t("focusMode.karaoke"), icon: "🎤" },
  ];
  const themes: { value: ReadingTheme; label: string; icon: string }[] = [
    { value: "flashlight", label: t("themes.flashlight"), icon: "🔦" },
    { value: "magnifier", label: t("themes.magnifier"), icon: "🔍" },
    { value: "magic-wand", label: t("themes.magicWand"), icon: "✨" },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-gray-100"
      role="toolbar"
      aria-label={t("title")}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{t("focusMode.label")}:</span>
        <div className="flex gap-1">
          {focusModes.map((m) => (
            <button
              key={m.value}
              className={`btn-kid px-3 py-2 text-sm rounded-xl ${
                focusMode === m.value
                  ? "bg-sky-100 text-sky-700 border-2 border-sky-300"
                  : "bg-gray-50 text-gray-600"
              }`}
              onClick={() => onFocusModeChange(m.value)}
              aria-label={`${m.label} mode`}
              aria-pressed={focusMode === m.value}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{t("settings.theme")}:</span>
        <div className="flex gap-1">
          {themes.map((themeOption) => (
            <button
              key={themeOption.value}
              className={`btn-kid px-3 py-2 text-sm rounded-xl ${
                theme === themeOption.value
                  ? "bg-orange-100 text-orange-700 border-2 border-orange-300"
                  : "bg-gray-50 text-gray-600"
              }`}
              onClick={() => onThemeChange(themeOption.value)}
              aria-label={`${themeOption.label} theme`}
              aria-pressed={theme === themeOption.value}
            >
              {themeOption.icon} {themeOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Letter Helper Toggle */}
      <button
        className={`btn-kid px-4 py-2 text-sm rounded-xl ${
          letterHelperEnabled
            ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
            : "bg-gray-50 text-gray-600"
        }`}
        onClick={onLetterHelperToggle}
        aria-label={`Letter helper ${letterHelperEnabled ? "on" : "off"}`}
        aria-pressed={letterHelperEnabled}
      >
        🔤 Letters {letterHelperEnabled ? "ON" : "OFF"}
      </button>

      <button
        className="btn-kid px-4 py-2 text-sm rounded-xl bg-yellow-50 text-yellow-800 border-2 border-yellow-200"
        onClick={onOpenLetterDetective}
        aria-label={t("letterHelper.detective")}
      >
        🕵️ {t("letterHelper.detective")}
      </button>

      <div className="flex items-center gap-2">
        <label htmlFor="font-size" className="text-sm font-medium">
          {t("settings.fontSize")}:
        </label>
        <input
          id="font-size"
          type="range"
          min={14}
          max={32}
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
          className="w-20"
          aria-label="Font size"
        />
        <span className="text-xs text-gray-500">{fontSize}px</span>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="line-spacing" className="text-sm font-medium">
          {t("settings.lineSpacing")}:
        </label>
        <input
          id="line-spacing"
          type="range"
          min={1.5}
          max={2.5}
          step={0.1}
          value={lineSpacing}
          onChange={(e) =>
            onLineSpacingChange(parseFloat(e.target.value))
          }
          className="w-20"
          aria-label="Line spacing"
        />
        <span className="text-xs text-gray-500">
          {lineSpacing.toFixed(1)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="mask-opacity" className="text-sm font-medium">
          {t("settings.maskOpacity")}:
        </label>
        <input
          id="mask-opacity"
          type="range"
          min={0}
          max={0.9}
          step={0.1}
          value={maskOpacity}
          onChange={(e) =>
            onMaskOpacityChange(parseFloat(e.target.value))
          }
          className="w-20"
          aria-label="Mask darkness"
        />
        <span className="text-xs text-gray-500">
          {Math.round(maskOpacity * 100)}%
        </span>
      </div>
    </div>
  );
}
