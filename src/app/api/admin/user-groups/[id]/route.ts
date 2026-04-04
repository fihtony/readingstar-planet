import { NextRequest, NextResponse } from "next/server";
import {
  getUserGroupById,
  updateUserGroup,
  deleteUserGroup,
} from "@/lib/repositories/user-group-repository";
import { checkPermission } from "@/lib/permissions";
import { logAdminAudit } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/admin/user-groups/[id] — update name/description */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const description =
    body.description !== undefined ? String(body.description).trim() : undefined;

  if (name !== undefined && name.length > 50) {
    return NextResponse.json(
      { error: "name must be 50 characters or fewer" },
      { status: 400 }
    );
  }
  if (description !== undefined && description.length > 200) {
    return NextResponse.json(
      { error: "description must be 200 characters or fewer" },
      { status: 400 }
    );
  }

  try {
    const group = updateUserGroup(id, { name, description });
    if (!group) {
      return NextResponse.json({ error: "User group not found" }, { status: 404 });
    }
    logAdminAudit(
      authContext.user!.id,
      "user_group_updated",
      "visibility",
      id,
      JSON.stringify({ name, description })
    );
    return NextResponse.json({ group });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A user group with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 });
  }
}

/** DELETE /api/admin/user-groups/[id] — delete user group */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  const { id } = await params;

  const existing = getUserGroupById(id);
  if (!existing) {
    return NextResponse.json({ error: "User group not found" }, { status: 404 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true";
  const result = deleteUserGroup(id, force);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Cannot delete group with members",
        memberCount: result.memberCount,
      },
      { status: 409 }
    );
  }

  logAdminAudit(
    authContext.user!.id,
    "user_group_deleted",
    "visibility",
    id,
    JSON.stringify({ name: existing.name, force })
  );

  return NextResponse.json({ success: true });
}
