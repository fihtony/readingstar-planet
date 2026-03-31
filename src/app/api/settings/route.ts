import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUserSettings,
  updateUserSettings,
} from "@/lib/repositories/settings-repository";
import { checkPermission } from "@/lib/permissions";
import { getDatabase } from "@/lib/db";
import { logUserActivity } from "@/lib/auth";

/**
 * GET /api/settings
 * - Guest: returns global default settings from app_metadata
 * - Authenticated user: returns personal user_settings
 */
export async function GET(request: NextRequest) {
  const { authContext } = await checkPermission(request, "public");

  if (authContext.user) {
    const settings = getOrCreateUserSettings(authContext.user.id);
    return NextResponse.json({ settings });
  }

  // Guest: return global defaults
  const defaults = getGlobalDefaults();
  return NextResponse.json({ settings: defaults });
}

/**
 * PUT /api/settings
 * - Authenticated user: updates personal settings
 * - Guest: rejected (401)
 */
export async function PUT(request: NextRequest) {
  const { authorized, response: permResponse, authContext } = await checkPermission(request, "authenticated");
  if (!authorized) return permResponse;

  try {
    const body = await request.json();
    const settings = updateUserSettings(authContext.user!.id, body);

    logUserActivity(
      authContext.user!.id,
      "settings_changed",
      JSON.stringify(body)
    );

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json(
      { error: "Invalid settings payload" },
      { status: 400 }
    );
  }
}

function getGlobalDefaults() {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT key, value FROM app_metadata WHERE key LIKE 'default_%'")
    .all() as Array<{ key: string; value: string }>;

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  return {
    userId: "guest",
    fontFamily: map.default_font_family ?? "opendyslexic",
    fontSize: Number(map.default_font_size ?? "20"),
    lineSpacing: Number(map.default_line_spacing ?? "1.8"),
    maskOpacity: Number(map.default_mask_opacity ?? "0.7"),
    ttsSpeed: Number(map.default_tts_speed ?? "0.8"),
    ttsPitch: Number(map.default_tts_pitch ?? "1.05"),
    ttsVoice: "",
    dailyTimeLimit: 30,
    theme: map.default_theme ?? "flashlight",
    locale: "en",
    updatedAt: new Date().toISOString(),
  };
}