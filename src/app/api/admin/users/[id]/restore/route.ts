import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getClientIp } from "@/lib/permissions";
import { getUserById, logAdminAudit, logUserActivity } from "@/lib/auth";
import { updateUser } from "@/lib/repositories/user-repository";
import { getDatabase } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/admin/users/[id]/restore — restore deleted/inactive user */
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

  if (target.status !== "deleted" && target.status !== "inactive") {
    return NextResponse.json(
      { error: "User is not in a restorable state" },
      { status: 400 }
    );
  }

  const db = getDatabase();
  db.transaction(() => {
    updateUser(targetId, { status: "active" });
    logAdminAudit(
      admin.id,
      "user_restored",
      "user",
      targetId,
      JSON.stringify({ previousStatus: target.status })
    );
    logUserActivity(
      admin.id,
      "admin_action",
      JSON.stringify({ action: "user_restored", targetId }),
      getClientIp(request)
    );
  })();

  const updated = getUserById(targetId);
  return NextResponse.json({ user: updated });
}
