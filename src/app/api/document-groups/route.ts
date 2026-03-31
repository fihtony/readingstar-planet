import { NextRequest, NextResponse } from "next/server";
import {
  createDocumentGroup,
  deleteDocumentGroup,
  ensureDefaultDocumentGroup,
  listDocumentGroups,
  reorderDocumentGroups,
  renameDocumentGroup,
} from "@/lib/repositories/document-group-repository";
import { checkPermission } from "@/lib/permissions";
import { logAdminAudit } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    groups: listDocumentGroups(),
  });
}

export async function POST(request: NextRequest) {
  const { authorized, response: permResponse, authContext } = await checkPermission(request, "admin");
  if (!authorized) return permResponse;

  try {
    const body = await request.json();
    const name = (body.name as string | undefined)?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 }
      );
    }

    const group = createDocumentGroup({
      userId: authContext.user!.id,
      name,
    });

    logAdminAudit(
      authContext.user!.id,
      "group_created",
      "group",
      group.id,
      JSON.stringify({ name: group.name })
    );

    return NextResponse.json({ group }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { authorized, response: permResponse, authContext } = await checkPermission(request, "admin");
  if (!authorized) return permResponse;

  try {
    const body = await request.json();

    if (body.action === "rename") {
      const groupId = body.groupId as string | undefined;
      const name = (body.name as string | undefined)?.trim();

      if (!groupId || !name) {
        return NextResponse.json(
          { error: "groupId and name are required" },
          { status: 400 }
        );
      }

      const group = renameDocumentGroup(groupId, name);
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      logAdminAudit(
        authContext.user!.id,
        "group_edited",
        "group",
        groupId,
        JSON.stringify({ action: "rename", name })
      );

      return NextResponse.json({ group });
    }

    const orderedGroupIds = body.orderedGroupIds as string[] | undefined;

    if (!Array.isArray(orderedGroupIds) || orderedGroupIds.length === 0) {
      return NextResponse.json(
        { error: "orderedGroupIds is required" },
        { status: 400 }
      );
    }

    const groups = reorderDocumentGroups(orderedGroupIds);

    logAdminAudit(
      authContext.user!.id,
      "group_edited",
      "group",
      null,
      JSON.stringify({ action: "reorder", orderedGroupIds })
    );

    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { authorized, response: permResponse, authContext } = await checkPermission(request, "admin");
  if (!authorized) return permResponse;

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Group id is required" },
      { status: 400 }
    );
  }

  const success = deleteDocumentGroup(id);
  if (!success) {
    return NextResponse.json(
      { error: "Group not found" },
      { status: 404 }
    );
  }

  logAdminAudit(
    authContext.user!.id,
    "group_deleted",
    "group",
    id,
    ""
  );

  return NextResponse.json({ success: true });
}