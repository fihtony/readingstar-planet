import { getDatabase } from "../db";
import type { FontFamily, Locale, ReadingTheme, UserSettings } from "@/types";

type SettingsUpdate = Partial<
  Pick<
    UserSettings,
    | "fontFamily"
    | "fontSize"
    | "lineSpacing"
    | "maskOpacity"
    | "ttsSpeed"
    | "ttsPitch"
    | "ttsVoice"
    | "dailyTimeLimit"
    | "theme"
    | "locale"
  >
>;

interface SettingsRow {
  user_id: string;
  font_family: FontFamily;
  font_size: number;
  line_spacing: number;
  mask_opacity: number;
  tts_speed: number;
  tts_pitch: number;
  tts_voice: string;
  daily_time_limit: number;
  theme: ReadingTheme;
  locale: Locale;
  updated_at: string;
}

function rowToSettings(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    fontFamily: row.font_family,
    fontSize: row.font_size,
    lineSpacing: row.line_spacing,
    maskOpacity: row.mask_opacity,
    ttsSpeed: row.tts_speed,
    ttsPitch: row.tts_pitch ?? 1.05,
    ttsVoice: row.tts_voice ?? "",
    dailyTimeLimit: row.daily_time_limit,
    theme: row.theme,
    locale: row.locale ?? "en",
    updatedAt: row.updated_at,
  };
}

export function getOrCreateUserSettings(userId: string): UserSettings {
  const db = getDatabase();
  const existing = db
    .prepare("SELECT * FROM user_settings WHERE user_id = ?")
    .get(userId) as SettingsRow | undefined;

  if (existing) {
    return rowToSettings(existing);
  }

  // Read global defaults from app_metadata so the new user inherits whatever
  // the admin has configured, rather than hardcoded fallback values.
  function getMeta(key: string, fallback: string): string {
    const row = db
      .prepare("SELECT value FROM app_metadata WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? fallback;
  }

  const fontFamily = getMeta("default_font_family", "opendyslexic") as FontFamily;
  const fontSize = parseInt(getMeta("default_font_size", "20"), 10);
  const lineSpacing = parseFloat(getMeta("default_line_spacing", "1.8"));
  const maskOpacity = parseFloat(getMeta("default_mask_opacity", "0.7"));
  const ttsSpeed = parseFloat(getMeta("default_tts_speed", "0.8"));
  const ttsPitch = parseFloat(getMeta("default_tts_pitch", "1.05"));
  const theme = getMeta("default_theme", "flashlight") as ReadingTheme;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_settings (
      user_id,
      font_family,
      font_size,
      line_spacing,
      mask_opacity,
      tts_speed,
      tts_pitch,
      tts_voice,
      daily_time_limit,
      theme,
      locale,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 30, ?, 'en', ?)`
  ).run(userId, fontFamily, fontSize, lineSpacing, maskOpacity, ttsSpeed, ttsPitch, theme, now);

  return {
    userId,
    fontFamily,
    fontSize,
    lineSpacing,
    maskOpacity,
    ttsSpeed,
    ttsPitch,
    ttsVoice: "",
    dailyTimeLimit: 30,
    theme,
    locale: "en",
    updatedAt: now,
  };
}

export function updateUserSettings(
  userId: string,
  updates: SettingsUpdate
): UserSettings {
  const db = getDatabase();
  const current = getOrCreateUserSettings(userId);
  const next: UserSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    `UPDATE user_settings
     SET font_family = ?,
         font_size = ?,
         line_spacing = ?,
         mask_opacity = ?,
         tts_speed = ?,
         tts_pitch = ?,
         tts_voice = ?,
         daily_time_limit = ?,
         theme = ?,
         locale = ?,
         updated_at = ?
     WHERE user_id = ?`
  ).run(
    next.fontFamily,
    next.fontSize,
    next.lineSpacing,
    next.maskOpacity,
    next.ttsSpeed,
    next.ttsPitch,
    next.ttsVoice,
    next.dailyTimeLimit,
    next.theme,
    next.locale,
    next.updatedAt,
    userId
  );

  return next;
}