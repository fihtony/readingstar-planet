import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getClientIp } from "@/lib/permissions";
import { logAdminAudit, logUserActivity } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import type { FontFamily, ReadingTheme, RegistrationPolicy } from "@/types";

type GlobalDefaults = {
  fontFamily: FontFamily;
  fontSize: number;
  lineSpacing: number;
  maskOpacity: number;
  ttsSpeed: number;
  ttsPitch: number;
  theme: ReadingTheme;
};

const DEFAULT_GLOBAL_SETTINGS: GlobalDefaults = {
  fontFamily: "opendyslexic",
  fontSize: 20,
  lineSpacing: 1.8,
  maskOpacity: 0.7,
  ttsSpeed: 0.8,
  ttsPitch: 1.05,
  theme: "flashlight",
};

const FIELD_TO_METADATA_KEY = {
  fontFamily: "default_font_family",
  fontSize: "default_font_size",
  lineSpacing: "default_line_spacing",
  maskOpacity: "default_mask_opacity",
  ttsSpeed: "default_tts_speed",
  ttsPitch: "default_tts_pitch",
  theme: "default_theme",
} as const;

function readGlobalSettings() {
  const db = getDatabase();
  const rows = db.prepare("SELECT key, value FROM app_metadata").all() as Array<{
    key: string;
    value: string;
  }>;
  const metadata = new Map(rows.map((row) => [row.key, row.value]));

  return {
    settings: {
      fontFamily:
        (metadata.get("default_font_family") as FontFamily | undefined) ??
        DEFAULT_GLOBAL_SETTINGS.fontFamily,
      fontSize: Number(
        metadata.get("default_font_size") ?? DEFAULT_GLOBAL_SETTINGS.fontSize
      ),
      lineSpacing: Number(
        metadata.get("default_line_spacing") ?? DEFAULT_GLOBAL_SETTINGS.lineSpacing
      ),
      maskOpacity: Number(
        metadata.get("default_mask_opacity") ?? DEFAULT_GLOBAL_SETTINGS.maskOpacity
      ),
      ttsSpeed: Number(
        metadata.get("default_tts_speed") ?? DEFAULT_GLOBAL_SETTINGS.ttsSpeed
      ),
      ttsPitch: Number(
        metadata.get("default_tts_pitch") ?? DEFAULT_GLOBAL_SETTINGS.ttsPitch
      ),
      theme:
        (metadata.get("default_theme") as ReadingTheme | undefined) ??
        DEFAULT_GLOBAL_SETTINGS.theme,
    },
    registrationPolicy:
      (metadata.get("registration_policy") as RegistrationPolicy | undefined) ??
      "invite-only",
  };
}

function parseGlobalSettingValue(
  field: keyof GlobalDefaults,
  rawValue: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  switch (field) {
    case "fontFamily": {
      const value = String(rawValue);
      if (value !== "opendyslexic" && value !== "system") {
        return { ok: false, error: "fontFamily must be 'opendyslexic' or 'system'" };
      }
      return { ok: true, value };
    }
    case "fontSize": {
      const value = Number(rawValue);
      if (!Number.isInteger(value) || value < 14 || value > 32) {
        return { ok: false, error: "fontSize must be an integer between 14 and 32" };
      }
      return { ok: true, value: String(value) };
    }
    case "lineSpacing": {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 1.5 || value > 2.5) {
        return { ok: false, error: "lineSpacing must be between 1.5 and 2.5" };
      }
      return { ok: true, value: String(value) };
    }
    case "maskOpacity": {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0 || value > 0.9) {
        return { ok: false, error: "maskOpacity must be between 0 and 0.9" };
      }
      return { ok: true, value: String(value) };
    }
    case "ttsSpeed": {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0.5 || value > 2) {
        return { ok: false, error: "ttsSpeed must be between 0.5 and 2.0" };
      }
      return { ok: true, value: String(value) };
    }
    case "ttsPitch": {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0.5 || value > 2) {
        return { ok: false, error: "ttsPitch must be between 0.5 and 2.0" };
      }
      return { ok: true, value: String(value) };
    }
    case "theme": {
      const value = String(rawValue);
      if (
        value !== "flashlight" &&
        value !== "magnifier" &&
        value !== "magic-wand"
      ) {
        return {
          ok: false,
          error: "theme must be 'flashlight', 'magnifier', or 'magic-wand'",
        };
      }
      return { ok: true, value };
    }
  }
}

/** GET /api/admin/settings — get global default settings + registration policy */
export async function GET(request: NextRequest) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  return NextResponse.json(readGlobalSettings());
}

/** PUT /api/admin/settings — update global default settings */
export async function PUT(request: NextRequest) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedUpdates: Array<{
    field: keyof GlobalDefaults;
    metadataKey: string;
    value: string;
  }> = [];

  for (const [field, metadataKey] of Object.entries(FIELD_TO_METADATA_KEY) as Array<[
    keyof GlobalDefaults,
    string,
  ]>) {
    const rawValue = body[field] ?? body[metadataKey];
    if (rawValue === undefined) {
      continue;
    }

    const parsed = parseGlobalSettingValue(field, rawValue);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    parsedUpdates.push({ field, metadataKey, value: parsed.value });
  }

  if (parsedUpdates.length === 0) {
    return NextResponse.json(
      { error: "No valid global settings fields were provided" },
      { status: 400 }
    );
  }

  const db = getDatabase();
  const admin = authContext.user!;
  const changes: Record<string, { from: string; to: string }> = {};

  const upsert = db.prepare(
    `INSERT INTO app_metadata (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const getCurrent = db.prepare("SELECT value FROM app_metadata WHERE key = ?");

  db.transaction(() => {
    for (const update of parsedUpdates) {
      const currentRow = getCurrent.get(update.metadataKey) as
        | { value: string }
        | undefined;
      const oldValue = currentRow?.value ?? "";
      if (oldValue === update.value) {
        continue;
      }

      changes[update.field] = { from: oldValue, to: update.value };
      upsert.run(update.metadataKey, update.value);
    }

    if (Object.keys(changes).length > 0) {
      logAdminAudit(
        admin.id,
        "default_settings_changed",
        "settings",
        null,
        JSON.stringify(changes)
      );
      logUserActivity(
        admin.id,
        "admin_action",
        JSON.stringify({ action: "default_settings_changed", changes }),
        getClientIp(request)
      );
    }
  })();

  return NextResponse.json(readGlobalSettings());
}
