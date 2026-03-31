import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  validateCsrfToken,
  logUserActivity,
  type AuthContext,
} from "./auth";
import type { User } from "@/types";

type PermLevel = "public" | "authenticated" | "admin";

interface PermissionCheckResult {
  authorized: boolean;
  response?: NextResponse;
  authContext: AuthContext;
}

/**
 * Check permissions for an API route handler.
 *
 * - "public": anyone can access (guests included)
 * - "authenticated": must be logged in with active status
 * - "admin": must be logged in with admin role and active status
 *
 * For state-changing methods (POST/PUT/PATCH/DELETE), CSRF token is validated.
 */
export async function checkPermission(
  request: NextRequest,
  level: PermLevel
): Promise<PermissionCheckResult> {
  const authContext = await getAuthContext();

  // CSRF check for state-changing methods
  const method = request.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfHeader = request.headers.get("x-csrf-token");
    const csrfValid = await validateCsrfToken(csrfHeader);
    if (!csrfValid) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Invalid or missing CSRF token" },
          { status: 403 }
        ),
        authContext,
      };
    }
  }

  if (level === "public") {
    return { authorized: true, authContext };
  }

  if (!authContext.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
      authContext,
    };
  }

  if (authContext.user.status !== "active") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Account is not active" },
        { status: 403 }
      ),
      authContext,
    };
  }

  if (level === "admin" && authContext.user.role !== "admin") {
    // Log forbidden action attempt
    logUserActivity(
      authContext.user.id,
      "forbidden_action_attempt",
      JSON.stringify({
        method,
        path: request.nextUrl.pathname,
      }),
      getClientIp(request)
    );
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
      authContext,
    };
  }

  return { authorized: true, authContext };
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

/**
 * Count active admins in the system.
 */
export function countActiveAdmins(): number {
  const { getDatabase } = require("./db");
  const db = getDatabase();
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'"
  ).get() as { count: number };
  return row.count;
}
