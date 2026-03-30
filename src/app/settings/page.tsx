"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MascotGuide } from "@/components/mascot/MascotGuide";
import { Button } from "@/components/ui/Button";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";
import type { ReadingTheme, UserSettings } from "@/types";

const DEFAULT_USER_ID = "default-user";

const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28, 32];
const LINE_SPACING_OPTIONS = [1.5, 1.8, 2.0, 2.5];
const TIME_LIMIT_OPTIONS = [10, 15, 20, 30, 45, 60];
const THEMES: { value: ReadingTheme; icon: string }[] = [
  { value: "flashlight", icon: "🔦" },
  { value: "magnifier", icon: "🔍" },
  { value: "magic-wand", icon: "✨" },
];

export default function SettingsPage() {
  const t = useTranslations("settings");
  const readingT = useTranslations("reading");
  const locale = useLocale();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/settings?userId=${DEFAULT_USER_ID}`)
      .then((res) => res.json())
      .then((data) => setSettings(data.settings))
      .catch(() => {});
  }, []);

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DEFAULT_USER_ID, [key]: value }),
      });
    } catch {
      // Best-effort save
    } finally {
      setSaving(false);
    }
  };

  const handleLocaleSwitch = (newLocale: string) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-bounce">🦉</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-warm-orange)" }}
        >
          ⚙️ {t("title")}
        </h1>
        {saving && (
          <span className="text-xs text-gray-400 ml-2">Saving...</span>
        )}
      </div>

      <MascotGuide
        message={
          locale === "zh"
            ? "在这里你可以调整阅读体验哦！"
            : "Customize your reading experience here!"
        }
        mood="happy"
      />

      {/* Language */}
      <SettingsSection title={`🌍 ${t("language")}`}>
        <div className="flex gap-2">
          {[
            { code: "en", label: "English", flag: "🇬🇧" },
            { code: "zh", label: "中文", flag: "🇨🇳" },
          ].map((loc) => (
            <button
              key={loc.code}
              className={`btn-kid px-4 py-3 text-sm rounded-xl ${
                locale === loc.code
                  ? "bg-sky-100 text-sky-700 border-2 border-sky-300"
                  : "bg-gray-50 text-gray-600 border-2 border-gray-200"
              }`}
              onClick={() => handleLocaleSwitch(loc.code)}
            >
              {loc.flag} {loc.label}
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Display */}
      <SettingsSection title={`🎨 ${t("display")}`}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">
              {readingT("settings.fontSize")}: {settings.fontSize}px
            </label>
            <div className="flex gap-2 flex-wrap">
              {FONT_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  className={`btn-kid px-3 py-2 text-sm rounded-xl ${
                    settings.fontSize === size
                      ? "bg-sky-100 text-sky-700 border-2 border-sky-300"
                      : "bg-gray-50 text-gray-600 border-2 border-gray-200"
                  }`}
                  onClick={() => updateSetting("fontSize", size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              {readingT("settings.lineSpacing")}: {settings.lineSpacing.toFixed(1)}x
            </label>
            <div className="flex gap-2">
              {LINE_SPACING_OPTIONS.map((spacing) => (
                <button
                  key={spacing}
                  className={`btn-kid px-4 py-2 text-sm rounded-xl ${
                    settings.lineSpacing === spacing
                      ? "bg-sky-100 text-sky-700 border-2 border-sky-300"
                      : "bg-gray-50 text-gray-600 border-2 border-gray-200"
                  }`}
                  onClick={() => updateSetting("lineSpacing", spacing)}
                >
                  {spacing.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Reading */}
      <SettingsSection title={`📖 ${t("reading")}`}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">
              {readingT("settings.theme")}
            </label>
            <div className="flex gap-2">
              {THEMES.map((th) => (
                <button
                  key={th.value}
                  className={`btn-kid px-4 py-3 text-sm rounded-xl ${
                    settings.theme === th.value
                      ? "bg-orange-100 text-orange-700 border-2 border-orange-300"
                      : "bg-gray-50 text-gray-600 border-2 border-gray-200"
                  }`}
                  onClick={() => updateSetting("theme", th.value)}
                >
                  {th.icon} {readingT(`themes.${th.value === "magic-wand" ? "magicWand" : th.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              {readingT("settings.maskOpacity")}:{" "}
              {Math.round(settings.maskOpacity * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.1}
              value={settings.maskOpacity}
              onChange={(e) =>
                updateSetting("maskOpacity", parseFloat(e.target.value))
              }
              className="w-full max-w-xs"
              aria-label={readingT("settings.maskOpacity")}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              TTS {readingT("tts.speed")}: {settings.ttsSpeed.toFixed(1)}x
            </label>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={settings.ttsSpeed}
              onChange={(e) =>
                updateSetting("ttsSpeed", parseFloat(e.target.value))
              }
              className="w-full max-w-xs"
              aria-label={`TTS ${readingT("tts.speed")}`}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Voice / TTS */}
      <VoiceSettingsSection
        settings={settings}
        updateSetting={updateSetting}
      />

      {/* Time Limit */}
      <SettingsSection title={`⏰ ${t("timeLimit")}`}>
        <div className="flex gap-2 flex-wrap">
          {TIME_LIMIT_OPTIONS.map((mins) => (
            <button
              key={mins}
              className={`btn-kid px-4 py-3 text-sm rounded-xl ${
                settings.dailyTimeLimit === mins
                  ? "bg-green-100 text-green-700 border-2 border-green-300"
                  : "bg-gray-50 text-gray-600 border-2 border-gray-200"
              }`}
              onClick={() => updateSetting("dailyTimeLimit", mins)}
            >
              {t("minutes", { count: mins })}
            </button>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white border-2 border-gray-100 p-5">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function VoiceSettingsSection({
  settings,
  updateSetting,
}: {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => void;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const load = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);

  const handlePreview = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(
      "Hello! I'm your reading buddy. Let's read together!"
    );
    utt.rate = settings.ttsSpeed;
    utt.pitch = settings.ttsPitch;
    if (settings.ttsVoice) {
      const match = voices.find((v) => v.name === settings.ttsVoice);
      if (match) utt.voice = match;
    }
    setPreviewing(true);
    utt.onend = () => setPreviewing(false);
    utt.onerror = () => setPreviewing(false);
    window.speechSynthesis.speak(utt);
  }, [settings.ttsSpeed, settings.ttsPitch, settings.ttsVoice, voices]);

  return (
    <SettingsSection title="🗣️ Voice / TTS">
      <div className="flex flex-col gap-4">
        {/* Voice selection */}
        <div>
          <label className="text-sm font-medium block mb-2">Voice</label>
          <select
            className="w-full max-w-xs rounded-xl border-2 border-gray-200 px-3 py-2 text-sm bg-white"
            value={settings.ttsVoice}
            onChange={(e) => updateSetting("ttsVoice", e.target.value)}
          >
            <option value="">Auto (best available)</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        {/* Pitch slider */}
        <div>
          <label className="text-sm font-medium block mb-2">
            Pitch: {settings.ttsPitch.toFixed(2)}
          </label>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={settings.ttsPitch}
            onChange={(e) =>
              updateSetting("ttsPitch", parseFloat(e.target.value))
            }
            className="w-full max-w-xs"
            aria-label="TTS Pitch"
          />
          <div className="flex justify-between text-xs text-gray-400 max-w-xs">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        {/* Preview button */}
        <div>
          <Button
            variant="secondary"
            size="md"
            onClick={handlePreview}
            disabled={previewing}
          >
            {previewing ? "🔊 Playing..." : "🔊 Preview Voice"}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
