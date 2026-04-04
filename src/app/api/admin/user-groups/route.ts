import { NextRequest, NextResponse } from "next/server";
import {
  listUserGroups,
  createUserGroup,
} from "@/lib/repositories/user-group-repository";
import { checkPermission } from "@/lib/permissions";
import { logAdminAudit } from "@/lib/auth";

/** GET /api/admin/user-groups — list all user groups with member counts */
export async function GET(request: NextRequest) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  const groups = listUserGroups();
  return NextResponse.json({ groups });
}

/** POST /api/admin/user-groups — create a new user group */
export async function POST(request: NextRequest) {
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

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }
  if (name.length > 50) {
    return NextResponse.json(
      { error: "name must be 50 characters or fewer" },
      { status: 400 }
    );
  }

  const description = String(body.description ?? "").trim();
  if (description.length > 200) {
    return NextResponse.json(
      { error: "description must be 200 characters or fewer" },
      { status: 400 }
    );
  }

  try {
    const group = createUserGroup({ name, description });
    logAdminAudit(
      authContext.user!.id,
      "user_group_created",
      "visibility",
      group.id,
      JSON.stringify({ name })
    );
    return NextResponse.json({ group }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A user group with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
