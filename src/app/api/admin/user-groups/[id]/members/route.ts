import { NextRequest, NextResponse } from "next/server";
import {
  getUserGroupById,
  listGroupMembers,
  addGroupMembers,
} from "@/lib/repositories/user-group-repository";
import { checkPermission } from "@/lib/permissions";
import { logAdminAudit } from "@/lib/auth";
import type { UserRole, UserStatus } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/user-groups/[id]/members */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  const { id } = await params;

  const group = getUserGroupById(id);
  if (!group) {
    return NextResponse.json({ error: "User group not found" }, { status: 404 });
  }

  const query = request.nextUrl.searchParams.get("query") ?? undefined;
  const role = (request.nextUrl.searchParams.get("role") ?? undefined) as
    | UserRole
    | undefined;
  const status = (request.nextUrl.searchParams.get("status") ?? undefined) as
    | UserStatus
    | undefined;
  const memberGroupId =
    request.nextUrl.searchParams.get("groupId") ?? undefined;

  const members = listGroupMembers(id, { query, role, status, memberGroupId });
  return NextResponse.json({ members });
}

/** POST /api/admin/user-groups/[id]/members — add members */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  const { id } = await params;

  const group = getUserGroupById(id);
  if (!group) {
    return NextResponse.json({ error: "User group not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userIds = body.userIds;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: "userIds must be a non-empty array" },
      { status: 400 }
    );
  }

  addGroupMembers(id, userIds as string[]);

  logAdminAudit(
    authContext.user!.id,
    "user_group_members_added",
    "visibility",
    id,
    JSON.stringify({ userIds })
  );

  return NextResponse.json({ success: true });
}
