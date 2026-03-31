import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getClientIp } from "@/lib/permissions";
import { logUserActivity, logAdminAudit } from "@/lib/auth";
import {
  createUser,
  listAllUsers,
} from "@/lib/repositories/user-repository";
import { getUserByEmail } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const MAX_NOTE_LENGTH = 5000;

function formatRecentDevice(row?: {
  browser_name: string;
  browser_version: string;
  os_name: string;
  os_version: string;
  device_type: string;
  device_model: string;
  last_seen_at: string;
}) {
  if (!row) {
    return null;
  }

  const browser = [row.browser_name, row.browser_version].filter(Boolean).join(" ");
  const os = [row.os_name, row.os_version].filter(Boolean).join(" ");
  const label = [browser || row.device_type || "Unknown", os, row.device_model]
    .filter(Boolean)
    .join(" · ");

  return {
    label,
    lastSeenAt: row.last_seen_at,
  };
}

/** GET /api/admin/users — list all users */
export async function GET(request: NextRequest) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  const db = getDatabase();
  const latestSession = db.prepare(
    `SELECT browser_name, browser_version, os_name, os_version, device_type, device_model, last_seen_at
     FROM auth_sessions
     WHERE user_id = ?
     ORDER BY last_seen_at DESC
     LIMIT 1`
  );

  const users = listAllUsers().map((user) => ({
    ...user,
    recentDevice: formatRecentDevice(
      latestSession.get(user.id) as
        | {
            browser_name: string;
            browser_version: string;
            os_name: string;
            os_version: string;
            device_type: string;
            device_model: string;
            last_seen_at: string;
          }
        | undefined
    ),
  }));

  return NextResponse.json({ users });
}

/** POST /api/admin/users — create (invite) a user */
export async function POST(request: NextRequest) {
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

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 }
    );
  }

  // Check duplicate email
  const existing = getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const role = body.role === "admin" ? "admin" : "user";
  const adminNotes = String(body.adminNotes ?? "");
  if (adminNotes.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `Admin notes must be ${MAX_NOTE_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const db = getDatabase();
  const admin = authContext.user!;
  const ip = getClientIp(request);

  const user = db.transaction(() => {
    const newUser = createUser({
      email,
      role,
      adminNotes,
      status: "pending_verification",
    });
    logAdminAudit(admin.id, "user_created", "user", newUser.id, JSON.stringify({ email, role }));
    logUserActivity(admin.id, "admin_action", JSON.stringify({ action: "user_created", email }), ip);
    return newUser;
  })();

  return NextResponse.json({ user }, { status: 201 });
}
