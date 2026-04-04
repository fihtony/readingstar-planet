import { NextRequest, NextResponse } from "next/server";
import {
  getUserGroupById,
  removeGroupMember,
} from "@/lib/repositories/user-group-repository";
import { checkPermission } from "@/lib/permissions";
import { logAdminAudit } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

/** DELETE /api/admin/user-groups/[id]/members/[userId] */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  const { id, userId } = await params;

  const group = getUserGroupById(id);
  if (!group) {
    return NextResponse.json({ error: "User group not found" }, { status: 404 });
  }

  const removed = removeGroupMember(id, userId);
  if (!removed) {
    return NextResponse.json(
      { error: "Member not found in this group" },
      { status: 404 }
    );
  }

  logAdminAudit(
    authContext.user!.id,
    "user_group_member_removed",
    "visibility",
    id,
    JSON.stringify({ userId })
  );

  return NextResponse.json({ success: true });
}
