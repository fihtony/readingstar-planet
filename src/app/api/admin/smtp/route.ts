import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getClientIp } from "@/lib/permissions";
import { logAdminAudit, logUserActivity } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

// SMTP keys stored in app_metadata.
// smtp_user and smtp_pass are stored encrypted (if READINGSTAR_ENCRYPTION_KEY is set).
const PLAINTEXT_KEYS = ["smtp_host", "smtp_port", "smtp_from"] as const;
const ENCRYPTED_KEYS = ["smtp_user", "smtp_pass"] as const;
const ALL_SMTP_KEYS = [...PLAINTEXT_KEYS, ...ENCRYPTED_KEYS];

function readSmtpSettings() {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT key, value FROM app_metadata WHERE key IN (${ALL_SMTP_KEYS.map(() => "?").join(",")})`
    )
    .all(...ALL_SMTP_KEYS) as { key: string; value: string }[];

  const meta = new Map(rows.map((r) => [r.key, r.value]));

  return {
    host: meta.get("smtp_host") ?? "",
    port: meta.get("smtp_port") ?? "587",
    // Decrypt user/pass; return masked value for the PW field so the UI can show a placeholder.
    user: meta.has("smtp_user") ? decrypt(meta.get("smtp_user")!) : "",
    // Never send password to the client — use a sentinel so the front-end knows it's set.
    hasPass: meta.has("smtp_pass") && meta.get("smtp_pass") !== "",
    from: meta.get("smtp_from") ?? "",
  };
}

/** GET /api/admin/smtp — return current SMTP settings (password omitted) */
export async function GET(request: NextRequest) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  return NextResponse.json(readSmtpSettings());
}

/** PUT /api/admin/smtp — update SMTP settings */
export async function PUT(request: NextRequest) {
  const { authorized, response, authContext } = await checkPermission(request, "admin");
  if (!authorized) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const host = typeof body.host === "string" ? body.host.trim() : undefined;
  const port = typeof body.port === "string" || typeof body.port === "number"
    ? String(body.port).trim()
    : undefined;
  const user = typeof body.user === "string" ? body.user.trim() : undefined;
  // password is optional — if omitted or empty-string, keep existing value
  const pass = typeof body.pass === "string" ? body.pass : undefined;
  const from = typeof body.from === "string" ? body.from.trim() : undefined;

  // Validate port if provided
  if (port !== undefined) {
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return NextResponse.json({ error: "port must be a number between 1 and 65535" }, { status: 400 });
    }
  }

  const db = getDatabase();
  const admin = authContext.user!;

  const upsert = db.prepare(
    `INSERT INTO app_metadata (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );

  db.transaction(() => {
    if (host !== undefined) upsert.run("smtp_host", host);
    if (port !== undefined) upsert.run("smtp_port", port);
    if (user !== undefined) upsert.run("smtp_user", encrypt(user));
    if (pass !== undefined && pass !== "") upsert.run("smtp_pass", encrypt(pass));
    if (from !== undefined) upsert.run("smtp_from", from);
  })();

  logAdminAudit(
    admin.id,
    "smtp_settings_changed",
    "settings",
    null,
    JSON.stringify({ fields: Object.keys(body).filter((k) => k !== "pass") })
  );
  logUserActivity(
    admin.id,
    "admin_action",
    JSON.stringify({ action: "smtp_settings_changed" }),
    getClientIp(request)
  );

  return NextResponse.json(readSmtpSettings());
}
