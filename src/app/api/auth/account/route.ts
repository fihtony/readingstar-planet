import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getLocationFromRequest } from "@/lib/permissions";
import {
  deleteAllUserSessions,
  clearSessionCookie,
  logUserActivity,
} from "@/lib/auth";
import { updateUser } from "@/lib/repositories/user-repository";

/** DELETE /api/auth/account — user self-delete */
export async function DELETE(request: NextRequest) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "authenticated"
  );
  if (!authorized) return response;

  const user = authContext.user!;

  // Admins cannot self-delete via this endpoint
  if (user.role === "admin") {
    return NextResponse.json(
      { error: "Admins cannot delete their own account via this endpoint" },
      { status: 409 }
    );
  }

  // Soft delete
  updateUser(user.id, { status: "deleted" });

  // Invalidate all sessions
  deleteAllUserSessions(user.id);

  // Log activity
  logUserActivity(
    user.id,
    "account_deleted",
    "",
    getLocationFromRequest(request)
  );

  await clearSessionCookie();

  return NextResponse.json({ success: true });
}
