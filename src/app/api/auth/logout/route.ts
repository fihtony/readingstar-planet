import { NextRequest, NextResponse } from "next/server";
import {
  deleteSession,
  clearSessionCookie,
  logUserActivity,
} from "@/lib/auth";
import { checkPermission, getLocationFromRequest } from "@/lib/permissions";

/** POST /api/auth/logout — log out current user */
export async function POST(request: NextRequest) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "authenticated"
  );
  if (!authorized) {
    return response;
  }

  const { user, sessionId } = authContext;

  if (sessionId) {
    deleteSession(sessionId);
  }

  if (user) {
    logUserActivity(user.id, "logout", "", getLocationFromRequest(request));
  }

  await clearSessionCookie();

  return NextResponse.json({ success: true });
}
