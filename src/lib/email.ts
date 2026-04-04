import nodemailer from "nodemailer";
import { decrypt } from "./encryption";
import { logger } from "./logger";

/**
 * SMTP configuration loaded from the database (app_metadata), falling back to
 * environment variables for backwards compatibility.
 *
 * Admin-managed keys stored in app_metadata:
 *   smtp_host, smtp_port, smtp_user (encrypted), smtp_pass (encrypted), smtp_from
 *
 * Note: When using Gmail SMTP, Google always delivers the message from the
 * authenticated account's address.  You can customise the display name by
 * setting smtp_from to:  Your Name <your-address@gmail.com>
 */

function loadSmtpConfig(): {
  host: string | null;
  port: number;
  user: string | null;
  pass: string | null;
  from: string | null;
} {
  // Lazily import DB to avoid circular deps / build-time issues.
  try {
    const { getDatabase } = require("./db") as typeof import("./db");
    const db = getDatabase();
    const rows = db
      .prepare(
        "SELECT key, value FROM app_metadata WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from')"
      )
      .all() as { key: string; value: string }[];

    if (rows.length > 0) {
      const meta = new Map(rows.map((r) => [r.key, r.value]));
      const host = meta.get("smtp_host") ?? null;
      const port = parseInt(meta.get("smtp_port") ?? "587", 10);
      const rawUser = meta.get("smtp_user") ?? null;
      const rawPass = meta.get("smtp_pass") ?? null;
      const from = meta.get("smtp_from") ?? null;
      return {
        host,
        port: Number.isFinite(port) ? port : 587,
        user: rawUser ? decrypt(rawUser) : null,
        pass: rawPass ? decrypt(rawPass) : null,
        from,
      };
    }
  } catch {
    // DB not available (e.g. during build) – fall through to env vars.
  }

  // Env-var fallback (legacy / initial setup):
  const user = process.env.SMTP_USER ?? null;
  return {
    host: process.env.SMTP_HOST ?? null,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    user,
    pass: process.env.SMTP_PASS ?? null,
    from: process.env.SMTP_FROM ?? user,
  };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const { host, port, user, pass, from } = loadSmtpConfig();

  if (!host || !user || !pass) {
    logger.warn("email", "SMTP not configured — email suppressed. Configure via Admin → Settings.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: from ?? user,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    text,
    html,
  });

  return true;
}
