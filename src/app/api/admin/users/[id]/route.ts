import { NextRequest, NextResponse } from "next/server";
import { checkPermission, getClientIp } from "@/lib/permissions";
import {
  logUserActivity,
  logAdminAudit,
  getUserById,
  deleteAllUserSessions,
} from "@/lib/auth";
import {
  updateUser,
  countActiveAdmins,
} from "@/lib/repositories/user-repository";
import { setUserGroups, getUserGroupIds } from "@/lib/repositories/user-group-repository";
import { getDatabase } from "@/lib/db";

const MAX_NOTE_LENGTH = 5000;

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/admin/users/[id] — edit user (role, status, notes) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate admin notes length
  if (body.adminNotes !== undefined) {
    const notes = String(body.adminNotes);
    if (notes.length > MAX_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Admin notes must be ${MAX_NOTE_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }
  }

  // Role change checks
  if (body.role !== undefined && body.role !== target.role) {
    const newRole = String(body.role);
    if (newRole !== "admin" && newRole !== "user") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Admin cannot demote themselves
    if (targetId === admin.id && newRole === "user") {
      return NextResponse.json(
        { error: "Cannot demote yourself from admin" },
        { status: 409 }
      );
    }

    // Last admin protection
    if (target.role === "admin" && newRole === "user") {
      if (countActiveAdmins() <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last active admin" },
          { status: 409 }
        );
      }
    }
  }

  // Status change checks (for deactivation/deletion)
  if (body.status !== undefined && body.status !== target.status) {
    const newStatus = String(body.status);

    if (newStatus === "inactive" || newStatus === "deleted") {
      // Admin cannot deactivate/delete themselves
      if (targetId === admin.id) {
        return NextResponse.json(
          { error: "Cannot deactivate or delete yourself" },
          { status: 409 }
        );
      }

      // Last admin protection
      if (target.role === "admin" && target.status === "active") {
        if (countActiveAdmins() <= 1) {
          return NextResponse.json(
            { error: "Cannot deactivate or delete the last active admin" },
            { status: 409 }
          );
        }
      }
    }
  }

  // Apply updates in a transaction with audit log
  const db = getDatabase();
  const changes: Record<string, unknown> = {};

  db.transaction(() => {
    const updates: Parameters<typeof updateUser>[1] = {};

    if (body.role !== undefined) {
      updates.role = body.role as "admin" | "user";
      changes.role = { from: target.role, to: body.role };
    }
    if (body.status !== undefined) {
      updates.status = body.status as "active" | "inactive" | "deleted" | "pending_verification";
      changes.status = { from: target.status, to: body.status };
    }
    if (body.adminNotes !== undefined) {
      updates.adminNotes = String(body.adminNotes);
      changes.adminNotes = true;
    }

    updateUser(targetId, updates);

    // If user is being deactivated or deleted, invalidate sessions
    if (body.status === "inactive" || body.status === "deleted") {
      deleteAllUserSessions(targetId);
    }

    // Handle user group assignment
    if (Array.isArray(body.userGroupIds)) {
      setUserGroups(targetId, body.userGroupIds as string[]);
      changes.userGroupIds = body.userGroupIds;
    }

    // Audit log (same transaction)
    const action = body.role !== undefined && body.role !== target.role
      ? "role_changed"
      : body.status !== undefined && body.status !== target.status
        ? "user_updated"
        : "user_updated";

    logAdminAudit(admin.id, action, "user", targetId, JSON.stringify(changes));
    logUserActivity(
      admin.id,
      "admin_action",
      JSON.stringify({ action, targetId, changes }),
      getClientIp(request)
    );
  })();

  const updated = getUserById(targetId);
  const userGroupIds = getUserGroupIds(targetId);
  return NextResponse.json({ user: { ...updated, userGroupIds } });
}

/** DELETE /api/admin/users/[id] — soft delete user */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  // Admin cannot delete themselves
  if (targetId === admin.id) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 409 }
    );
  }

  // Last admin protection
  if (target.role === "admin" && target.status === "active") {
    if (countActiveAdmins() <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last active admin" },
        { status: 409 }
      );
    }
  }

  const db = getDatabase();
  db.transaction(() => {
    updateUser(targetId, { status: "deleted" });
    deleteAllUserSessions(targetId);
    logAdminAudit(admin.id, "user_deleted", "user", targetId, "");
    logUserActivity(
      admin.id,
      "admin_action",
      JSON.stringify({ action: "user_deleted", targetId }),
      getClientIp(request)
    );
  })();

  return NextResponse.json({ success: true });
}
