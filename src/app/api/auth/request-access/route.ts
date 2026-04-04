import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/request-access — send an access request email to all active admins */
export async function POST(request: NextRequest) {
  // SQLite-backed rate limiting: 1 submission per IP per minute, survives restarts
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(`request-access:${ip}`, 1, 60_000)) {
    return NextResponse.json(
      { error: "Please wait a moment before submitting another request." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const requesterEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.trim().substring(0, 500) : "";

  if (!requesterEmail || !EMAIL_REGEX.test(requesterEmail)) {
    return NextResponse.json(
      { error: "Please provide a valid email address." },
      { status: 400 }
    );
  }

  // Check if this system is actually invite-only
  const db = getDatabase();
  const policyRow = db
    .prepare("SELECT value FROM app_metadata WHERE key = 'registration_policy'")
    .get() as { value: string } | undefined;
  const policy = policyRow?.value ?? "invite-only";

  if (policy !== "invite-only") {
    // Not invite-only — user should just log in normally
    return NextResponse.json(
      { error: "This system is open for registration. Please try logging in again." },
      { status: 400 }
    );
  }

  // Fetch active admin emails — never returned to the caller
  const adminRows = db
    .prepare(
      "SELECT email FROM users WHERE role = 'admin' AND status = 'active' AND email NOT LIKE '%@readingstar.local'"
    )
    .all() as { email: string }[];

  const adminEmails = adminRows.map((r) => r.email).filter(Boolean);

  if (adminEmails.length === 0) {
    // No admin email configured — still acknowledge so we don't leak info
    logger.warn("request-access", "No active admin emails found to notify.");
    return NextResponse.json({ success: true });
  }

  const subject = "ReadingStar: New Access Request";
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#e87d2c">ReadingStar Planet — Access Request</h2>
  <p>A user has requested access to the system.</p>
  <table style="border-collapse:collapse;width:100%">
    <tr>
      <td style="padding:8px;font-weight:bold;background:#f9f9f9;border:1px solid #eee;width:160px">Requester Email</td>
      <td style="padding:8px;border:1px solid #eee">${escapeHtml(requesterEmail)}</td>
    </tr>
    ${message ? `
    <tr>
      <td style="padding:8px;font-weight:bold;background:#f9f9f9;border:1px solid #eee">Message</td>
      <td style="padding:8px;border:1px solid #eee">${escapeHtml(message)}</td>
    </tr>` : ""}
  </table>
  <p style="margin-top:16px;color:#666;font-size:13px">
    To grant access, log in to ReadingStar as an admin, go to Admin &rarr; Users, and add the requester&apos;s Google email address.
  </p>
</div>`.trim();

  const text =
    `ReadingStar Planet — Access Request\n\n` +
    `Requester Email: ${requesterEmail}\n` +
    (message ? `Message: ${message}\n` : "") +
    `\nTo grant access, add the requester's Google email via Admin → Users.`;

  try {
    await sendEmail({ to: adminEmails, subject, html, text });
  } catch (err) {
    logger.error("request-access", "Failed to send email", err);
    // Still return success so the UI doesn't expose internal errors
  }

  return NextResponse.json({ success: true });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
