import { getDatabase } from "../db";
import type { FontFamily, ReadingTheme, UserSettings } from "@/types";

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
      updated_at
    ) VALUES (?, 'opendyslexic', 20, 1.8, 0.7, 0.8, 1.05, '', 30, 'flashlight', ?)`
  ).run(userId, now);

  return {
    userId,
    fontFamily: "opendyslexic",
    fontSize: 20,
    lineSpacing: 1.8,
    maskOpacity: 0.7,
    ttsSpeed: 0.8,
    ttsPitch: 1.05,
    ttsVoice: "",
    dailyTimeLimit: 30,
    theme: "flashlight",
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
    next.updatedAt,
    userId
  );

  return next;
}