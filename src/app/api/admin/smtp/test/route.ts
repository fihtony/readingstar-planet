import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/admin/smtp/test — send a test email to verify SMTP settings */
export async function POST(request: NextRequest) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to || !EMAIL_REGEX.test(to)) {
    return NextResponse.json(
      { error: "Please provide a valid recipient email address." },
      { status: 400 }
    );
  }

  try {
    const sent = await sendEmail({
      to,
      subject: "ReadingStar SMTP Test",
      html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#e87d2c">ReadingStar — SMTP Test</h2>
  <p>This is a test email sent from your ReadingStar admin settings.</p>
  <p style="color:#666;font-size:13px">If you received this, your SMTP configuration is working correctly.</p>
</div>`.trim(),
      text: "ReadingStar SMTP Test\n\nThis is a test email sent from your ReadingStar admin settings.\n\nIf you received this, your SMTP configuration is working correctly.",
    });

    if (!sent) {
      return NextResponse.json(
        { error: "SMTP is not configured. Please save your SMTP settings first." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
