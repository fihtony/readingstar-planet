import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getClientIp } from "@/lib/permissions";
import {
  getUserById,
  deleteAllUserSessions,
  logAdminAudit,
  logUserActivity,
} from "@/lib/auth";
import { getDatabase } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/admin/users/[id]/force-logout — force logout all sessions */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  const { id: targetId } = await params;
  const admin = authContext.user!;

  const target = getUserById(targetId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const db = getDatabase();
  const ip = getClientIp(request);

  db.transaction(() => {
    deleteAllUserSessions(targetId);
    logAdminAudit(admin.id, "user_force_logout", "user", targetId, "");
    logUserActivity(
      admin.id,
      "admin_action",
      JSON.stringify({ action: "user_force_logout", targetId }),
      ip
    );
  })();

  return NextResponse.json({ success: true });
}
