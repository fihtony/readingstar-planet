import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getLocationFromRequest } from "@/lib/permissions";
import { logAdminAudit, logUserActivity } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import type { RegistrationPolicy } from "@/types";

function readRegistrationPolicy(): RegistrationPolicy {
  const db = getDatabase();
  const row = db.prepare(
    "SELECT value FROM app_metadata WHERE key = 'registration_policy'"
  ).get() as { value: string } | undefined;
  return row?.value === "open" ? "open" : "invite-only";
}

/** GET /api/admin/registration-policy — read current registration policy */
export async function GET(request: NextRequest) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  return NextResponse.json({ policy: readRegistrationPolicy() });
}

/** PATCH /api/admin/registration-policy — switch registration policy */
export async function PATCH(request: NextRequest) {
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

  const policy = String(body.policy ?? "");
  if (policy !== "open" && policy !== "invite-only") {
    return NextResponse.json(
      { error: "Policy must be 'open' or 'invite-only'" },
      { status: 400 }
    );
  }

  const db = getDatabase();
  const admin = authContext.user!;
  const oldPolicy = readRegistrationPolicy();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO app_metadata (key, value, updated_at)
       VALUES ('registration_policy', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(policy);

    logAdminAudit(
      admin.id,
      "registration_policy_changed",
      "settings",
      null,
      JSON.stringify({ from: oldPolicy, to: policy })
    );
    logUserActivity(
      admin.id,
      "admin_action",
      JSON.stringify({ action: "registration_policy_changed", from: oldPolicy, to: policy }),
      getLocationFromRequest(request)
    );
  })();

  return NextResponse.json({ policy });
}
