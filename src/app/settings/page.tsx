"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MascotGuide } from "@/components/mascot/MascotGuide";
import { Button } from "@/components/ui/Button";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";
import { useAuth, useCsrfFetch } from "@/hooks/useAuth";
import type {
  FontFamily,
  Locale,
  ReadingTheme,
  RegistrationPolicy,
  UserSettings,
} from "@/types";

const GUEST_SETTINGS_STORAGE_KEY = "rs_guest_settings";
const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28, 32];
const LINE_SPACING_OPTIONS = [1.5, 1.8, 2.0, 2.5];
const TIME_LIMIT_OPTIONS = [10, 15, 20, 30, 45, 60];
const THEMES: { value: ReadingTheme; icon: string; label: string }[] = [
  { value: "flashlight", icon: "🔦", label: "Flashlight" },
  { value: "magnifier", icon: "🔍", label: "Magnifier" },
  { value: "magic-wand", icon: "✨", label: "Magic Wand" },
];
const FONT_FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "opendyslexic", label: "OpenDyslexic" },
  { value: "system", label: "System" },
];

type GlobalDefaults = Pick<
  UserSettings,
  "fontFamily" | "fontSize" | "lineSpacing" | "maskOpacity" | "ttsSpeed" | "ttsPitch" | "theme"
>;

const DEFAULT_SETTINGS: UserSettings = {
  userId: "guest",
  fontFamily: "opendyslexic",
  fontSize: 20,
  lineSpacing: 1.8,
  maskOpacity: 0.7,
  ttsSpeed: 0.8,
  ttsPitch: 1.05,
  ttsVoice: "",
  dailyTimeLimit: 30,
  theme: "flashlight",
  locale: "en",
  updatedAt: "",
};

const DEFAULT_GLOBAL_DEFAULTS: GlobalDefaults = {
  fontFamily: "opendyslexic",
  fontSize: 20,
  lineSpacing: 1.8,
  maskOpacity: 0.7,
  ttsSpeed: 0.8,
  ttsPitch: 1.05,
  theme: "flashlight",
};

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeFontFamily(value: unknown): FontFamily {
  return value === "system" ? "system" : "opendyslexic";
}

function normalizeTheme(value: unknown): ReadingTheme {
  if (value === "magnifier" || value === "magic-wand") {
    return value;
  }
  return "flashlight";
}

function normalizeLocale(value: unknown): Locale {
  return value === "zh" ? "zh" : "en";
}

function normalizeSettings(raw?: Partial<UserSettings> | null): UserSettings {
  return {
    userId: typeof raw?.userId === "string" ? raw.userId : DEFAULT_SETTINGS.userId,
    fontFamily: normalizeFontFamily(raw?.fontFamily),
    fontSize: clampNumber(raw?.fontSize, DEFAULT_SETTINGS.fontSize, 14, 32),
    lineSpacing: clampNumber(raw?.lineSpacing, DEFAULT_SETTINGS.lineSpacing, 1.5, 2.5),
    maskOpacity: clampNumber(raw?.maskOpacity, DEFAULT_SETTINGS.maskOpacity, 0, 0.9),
    ttsSpeed: clampNumber(raw?.ttsSpeed, DEFAULT_SETTINGS.ttsSpeed, 0.5, 2),
    ttsPitch: clampNumber(raw?.ttsPitch, DEFAULT_SETTINGS.ttsPitch, 0.5, 2),
    ttsVoice: typeof raw?.ttsVoice === "string" ? raw.ttsVoice : "",
    dailyTimeLimit: clampNumber(raw?.dailyTimeLimit, DEFAULT_SETTINGS.dailyTimeLimit, 5, 120),
    theme: normalizeTheme(raw?.theme),
    locale: normalizeLocale(raw?.locale),
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt.length > 0
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

function normalizeGlobalDefaults(raw?: Partial<GlobalDefaults> | null): GlobalDefaults {
  return {
    fontFamily: normalizeFontFamily(raw?.fontFamily),
    fontSize: clampNumber(raw?.fontSize, DEFAULT_GLOBAL_DEFAULTS.fontSize, 14, 32),
    lineSpacing: clampNumber(raw?.lineSpacing, DEFAULT_GLOBAL_DEFAULTS.lineSpacing, 1.5, 2.5),
    maskOpacity: clampNumber(raw?.maskOpacity, DEFAULT_GLOBAL_DEFAULTS.maskOpacity, 0, 0.9),
    ttsSpeed: clampNumber(raw?.ttsSpeed, DEFAULT_GLOBAL_DEFAULTS.ttsSpeed, 0.5, 2),
    ttsPitch: clampNumber(raw?.ttsPitch, DEFAULT_GLOBAL_DEFAULTS.ttsPitch, 0.5, 2),
    theme: normalizeTheme(raw?.theme),
  };
}

function readGuestSettings(): UserSettings | null {
  try {
    const raw = window.sessionStorage.getItem(GUEST_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeSettings(JSON.parse(raw) as Partial<UserSettings>);
  } catch {
    return null;
  }
}

function writeGuestSettings(settings: UserSettings) {
  window.sessionStorage.setItem(
    GUEST_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings)
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const readingT = useTranslations("reading");
  const locale = useLocale();
  const router = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();
  const csrfFetch = useCsrfFetch();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (!isAuthenticated) {
        const guestSettings = readGuestSettings();
        if (guestSettings) {
          if (!cancelled) {
            setSettings(guestSettings);
          }
          return;
        }
      }

      try {
        const response = await fetch("/api/settings");
        if (!response.ok) {
          throw new Error("Failed to load settings");
        }
        const data = await response.json();
        if (!cancelled) {
          setSettings(normalizeSettings(data.settings));
        }
      } catch {
        if (!cancelled) {
          setSettings(normalizeSettings(null));
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const updateSetting = useCallback(
    async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      if (!settings) {
        return;
      }

      const previousSettings = settings;
      const nextSettings = normalizeSettings({
        ...settings,
        [key]: value,
        updatedAt: new Date().toISOString(),
      });

      setSettings(nextSettings);
      setSettingsSaving(true);
      setSettingsError(null);

      try {
        if (!isAuthenticated) {
          writeGuestSettings(nextSettings);
          return;
        }

        const response = await csrfFetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save settings");
        }

        const data = await response.json();
        setSettings(normalizeSettings(data.settings));
      } catch (error) {
        setSettings(previousSettings);
        setSettingsError(
          error instanceof Error ? error.message : "Failed to save settings"
        );
      } finally {
        setSettingsSaving(false);
      }
    },
    [csrfFetch, isAuthenticated, settings]
  );

  const handleLocaleSwitch = async (newLocale: Locale) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; samesite=lax`;
    if (settings && settings.locale !== newLocale) {
      await updateSetting("locale", newLocale);
    }
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
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-warm-orange)" }}
        >
          ⚙️ {t("title")}
        </h1>
        <div className="mt-2 min-h-5 text-xs">
          {settingsSaving ? (
            <span className="text-gray-500">Saving settings...</span>
          ) : settingsError ? (
            <span className="text-orange-600">{settingsError}</span>
          ) : !isAuthenticated ? (
            <span className="text-amber-700">
              Guest changes are stored for this tab only.
            </span>
          ) : null}
        </div>
      </div>

      <MascotGuide
        message={
          locale === "zh"
            ? "在这里你可以调整阅读体验哦！"
            : "Customize your reading experience here!"
        }
        mood="happy"
      />

      <SettingsSection title={`🌍 ${t("language")}`}>
        <div className="flex gap-2">
          {[
            { code: "en" as Locale, label: "English", flag: "🇬🇧" },
            { code: "zh" as Locale, label: "中文", flag: "🇨🇳" },
          ].map((loc) => (
            <button
              key={loc.code}
              className={`btn-kid rounded-xl px-4 py-3 text-sm ${
                locale === loc.code
                  ? "border-2 border-sky-300 bg-sky-100 text-sky-700"
                  : "border-2 border-gray-200 bg-gray-50 text-gray-600"
              }`}
              onClick={() => void handleLocaleSwitch(loc.code)}
            >
              {loc.flag} {loc.label}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={`🎨 ${t("display")}`}>
        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {readingT("settings.fontSize")}: {settings.fontSize}px
            </label>
            <div className="flex gap-2 flex-wrap">
              {FONT_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  className={`btn-kid rounded-xl px-3 py-2 text-sm ${
                    settings.fontSize === size
                      ? "border-2 border-sky-300 bg-sky-100 text-sky-700"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateSetting("fontSize", size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {readingT("settings.lineSpacing")}: {settings.lineSpacing.toFixed(1)}x
            </label>
            <div className="flex gap-2 flex-wrap">
              {LINE_SPACING_OPTIONS.map((spacing) => (
                <button
                  key={spacing}
                  className={`btn-kid rounded-xl px-4 py-2 text-sm ${
                    settings.lineSpacing === spacing
                      ? "border-2 border-sky-300 bg-sky-100 text-sky-700"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateSetting("lineSpacing", spacing)}
                >
                  {spacing.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={`📖 ${t("reading")}`}>
        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {readingT("settings.theme")}
            </label>
            <div className="flex gap-2 flex-wrap">
              {THEMES.map((theme) => (
                <button
                  key={theme.value}
                  className={`btn-kid rounded-xl px-4 py-3 text-sm ${
                    settings.theme === theme.value
                      ? "border-2 border-orange-300 bg-orange-100 text-orange-700"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateSetting("theme", theme.value)}
                >
                  {theme.icon} {theme.value === "magic-wand" ? readingT("themes.magicWand") : readingT(`themes.${theme.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {readingT("settings.maskOpacity")}: {Math.round(settings.maskOpacity * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.1}
              value={settings.maskOpacity}
              onChange={(event) =>
                void updateSetting("maskOpacity", Number(event.target.value))
              }
              className="w-full max-w-xs"
              aria-label={readingT("settings.maskOpacity")}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              TTS {readingT("tts.speed")}: {settings.ttsSpeed.toFixed(1)}x
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.ttsSpeed}
              onChange={(event) =>
                void updateSetting("ttsSpeed", Number(event.target.value))
              }
              className="w-full max-w-xs"
              aria-label={`TTS ${readingT("tts.speed")}`}
            />
          </div>
        </div>
      </SettingsSection>

      <VoiceSettingsSection settings={settings} updateSetting={updateSetting} />

      <SettingsSection title={`⏰ ${t("timeLimit")}`}>
        <div className="flex gap-2 flex-wrap">
          {TIME_LIMIT_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              className={`btn-kid rounded-xl px-4 py-3 text-sm ${
                settings.dailyTimeLimit === minutes
                  ? "border-2 border-green-300 bg-green-100 text-green-700"
                  : "border-2 border-gray-200 bg-gray-50 text-gray-600"
              }`}
              onClick={() => void updateSetting("dailyTimeLimit", minutes)}
            >
              {t("minutes", { count: minutes })}
            </button>
          ))}
        </div>
      </SettingsSection>

      {!isAuthenticated && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Sign in to save your settings permanently. Guest changes stay in this tab only and do not migrate after login.
        </div>
      )}

      {isAuthenticated && (
        <div className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-4 text-sm text-sky-800">
          Manage your nickname, avatar, and account settings on the{" "}
          <a href="/profile" className="font-semibold underline hover:text-sky-600">
            Profile page
          </a>
          .
        </div>
      )}

      {isAdmin && <AdminGlobalSettingsSection />}
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
    <section className="rounded-2xl border-2 border-gray-100 bg-white p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
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
  ) => Promise<void>;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const handlePreview = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    // Stop if already previewing
    if (previewing) {
      window.speechSynthesis.cancel();
      setPreviewing(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      "Hello! I'm your reading buddy. Let's read together!"
    );
    utterance.rate = settings.ttsSpeed;
    utterance.pitch = settings.ttsPitch;
    if (settings.ttsVoice) {
      const match = voices.find((voice) => voice.name === settings.ttsVoice);
      if (match) {
        utterance.voice = match;
      }
    }

    setPreviewing(true);
    utterance.onend = () => setPreviewing(false);
    utterance.onerror = () => setPreviewing(false);
    window.speechSynthesis.speak(utterance);
  }, [previewing, settings.ttsPitch, settings.ttsSpeed, settings.ttsVoice, voices]);

  return (
    <SettingsSection title="🗣️ Voice / TTS">
      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-2 block text-sm font-medium">Voice</label>
          <select
            className="w-full max-w-md rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm"
            value={settings.ttsVoice}
            onChange={(event) => void updateSetting("ttsVoice", event.target.value)}
          >
            <option value="">Auto (best available)</option>
            {voices
              .filter((voice) => voice.lang.startsWith("en"))
              .map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Pitch: {settings.ttsPitch.toFixed(2)}
          </label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={settings.ttsPitch}
            onChange={(event) =>
              void updateSetting("ttsPitch", Number(event.target.value))
            }
            className="w-full max-w-xs"
            aria-label="TTS Pitch"
          />
          <div className="flex max-w-xs justify-between text-xs text-gray-400">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div>
          <Button variant="secondary" onClick={handlePreview}>
            {previewing ? "⏹ Stop" : "🔊 Preview Voice"}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}

function AdminGlobalSettingsSection() {
  const csrfFetch = useCsrfFetch();
  const [settings, setSettings] = useState<GlobalDefaults | null>(null);
  const [registrationPolicy, setRegistrationPolicy] = useState<RegistrationPolicy>(
    "invite-only"
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAdminSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/settings");
        if (!response.ok) {
          throw new Error("Failed to load admin settings");
        }

        const data = await response.json();
        if (!cancelled) {
          setSettings(normalizeGlobalDefaults(data.settings));
          setRegistrationPolicy(
            data.registrationPolicy === "open" ? "open" : "invite-only"
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load admin settings"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAdminSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateGlobalSetting = useCallback(
    async <K extends keyof GlobalDefaults>(
      key: K,
      value: GlobalDefaults[K]
    ) => {
      if (!settings) {
        return;
      }

      const previousSettings = settings;
      const nextSettings = normalizeGlobalDefaults({ ...settings, [key]: value });
      setSettings(nextSettings);
      setSaving(true);
      setError(null);

      try {
        const response = await csrfFetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save global settings");
        }

        const data = await response.json();
        setSettings(normalizeGlobalDefaults(data.settings));
        setRegistrationPolicy(
          data.registrationPolicy === "open" ? "open" : "invite-only"
        );
      } catch (saveError) {
        setSettings(previousSettings);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save global settings"
        );
      } finally {
        setSaving(false);
      }
    },
    [csrfFetch, settings]
  );

  const updateRegistrationPolicy = useCallback(
    async (nextPolicy: RegistrationPolicy) => {
      if (nextPolicy === registrationPolicy) {
        return;
      }

      const confirmed = window.confirm(
        `Switch registration policy to ${
          nextPolicy === "open" ? "Open Registration" : "Invite Only"
        }?`
      );
      if (!confirmed) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const response = await csrfFetch("/api/admin/registration-policy", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policy: nextPolicy }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update registration policy");
        }

        const data = await response.json();
        setRegistrationPolicy(data.policy === "open" ? "open" : "invite-only");
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to update registration policy"
        );
      } finally {
        setSaving(false);
      }
    },
    [csrfFetch, registrationPolicy]
  );

  return (
    <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 relative overflow-hidden">
      {/* Subtle decorative stripe on the left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-amber-400" aria-hidden="true" />
      <h2 className="mb-1 text-lg font-bold text-amber-900">🛡️ Admin: Global Defaults</h2>
      <p className="mb-4 text-xs font-medium text-amber-700/70 uppercase tracking-wide">Admin only</p>
      {loading || !settings ? (
        <p className="text-sm text-gray-500">Loading admin settings...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-gray-600">
            These defaults affect guests and new users. Existing personal overrides are preserved.
          </p>

          <div>
            <label className="mb-2 block text-sm font-medium">Default Font Family</label>
            <div className="flex gap-2 flex-wrap">
              {FONT_FAMILY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`btn-kid rounded-xl px-4 py-2 text-sm ${
                    settings.fontFamily === option.value
                      ? "border-2 border-amber-300 bg-amber-100 text-amber-800"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateGlobalSetting("fontFamily", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Default Font Size</label>
            <div className="flex gap-2 flex-wrap">
              {FONT_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  className={`btn-kid rounded-xl px-3 py-2 text-sm ${
                    settings.fontSize === size
                      ? "border-2 border-amber-300 bg-amber-100 text-amber-800"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateGlobalSetting("fontSize", size)}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Default Line Spacing</label>
            <div className="flex gap-2 flex-wrap">
              {LINE_SPACING_OPTIONS.map((spacing) => (
                <button
                  key={spacing}
                  className={`btn-kid rounded-xl px-4 py-2 text-sm ${
                    settings.lineSpacing === spacing
                      ? "border-2 border-amber-300 bg-amber-100 text-amber-800"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateGlobalSetting("lineSpacing", spacing)}
                >
                  {spacing.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Default Mask Opacity: {Math.round(settings.maskOpacity * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.1}
              value={settings.maskOpacity}
              onChange={(event) =>
                void updateGlobalSetting("maskOpacity", Number(event.target.value))
              }
              className="w-full max-w-xs"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Default TTS Speed: {settings.ttsSpeed.toFixed(1)}x
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.ttsSpeed}
              onChange={(event) =>
                void updateGlobalSetting("ttsSpeed", Number(event.target.value))
              }
              className="w-full max-w-xs"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Default TTS Pitch: {settings.ttsPitch.toFixed(2)}
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={settings.ttsPitch}
              onChange={(event) =>
                void updateGlobalSetting("ttsPitch", Number(event.target.value))
              }
              className="w-full max-w-xs"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Default Theme</label>
            <div className="flex gap-2 flex-wrap">
              {THEMES.map((theme) => (
                <button
                  key={theme.value}
                  className={`btn-kid rounded-xl px-4 py-3 text-sm ${
                    settings.theme === theme.value
                      ? "border-2 border-amber-300 bg-amber-100 text-amber-800"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateGlobalSetting("theme", theme.value)}
                >
                  {theme.icon} {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Registration Policy</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "invite-only" as RegistrationPolicy, label: "Invite Only" },
                { value: "open" as RegistrationPolicy, label: "Open Registration" },
              ].map((option) => (
                <button
                  key={option.value}
                  className={`btn-kid rounded-xl px-4 py-2 text-sm ${
                    registrationPolicy === option.value
                      ? "border-2 border-amber-300 bg-amber-100 text-amber-800"
                      : "border-2 border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => void updateRegistrationPolicy(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {saving && <p className="mt-4 text-xs text-amber-700">Saving admin settings...</p>}
      {error && <p className="mt-4 text-sm text-orange-600">{error}</p>}
    </section>
  );
}
