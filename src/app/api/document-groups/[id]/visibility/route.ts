import { NextRequest, NextResponse } from "next/server";
import {
  getDocumentGroupById,
  setDocumentGroupVisibility,
} from "@/lib/repositories/document-group-repository";
import { getUserGroupById } from "@/lib/repositories/user-group-repository";
import { checkPermission } from "@/lib/permissions";
import { logAdminAudit } from "@/lib/auth";
import type { VisibilityType } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_VISIBILITY: VisibilityType[] = ["public", "admin_only", "user_groups"];

/** PATCH /api/document-groups/[id]/visibility */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  const { id } = await params;

  const group = getDocumentGroupById(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const visibility = body.visibility as VisibilityType | undefined;
  if (!visibility || !VALID_VISIBILITY.includes(visibility)) {
    return NextResponse.json(
      { error: `visibility must be one of: ${VALID_VISIBILITY.join(", ")}` },
      { status: 400 }
    );
  }

  const userGroupIds = (body.userGroupIds as string[] | undefined) ?? [];

  if (visibility === "user_groups" && userGroupIds.length === 0) {
    return NextResponse.json(
      { error: "userGroupIds is required when visibility = user_groups" },
      { status: 422 }
    );
  }

  // Validate that all referenced user groups exist
  if (visibility === "user_groups") {
    for (const ugId of userGroupIds) {
      const ug = getUserGroupById(ugId);
      if (!ug) {
        return NextResponse.json(
          { error: `User group not found: ${ugId}` },
          { status: 404 }
        );
      }
    }
  }

  const updated = setDocumentGroupVisibility(id, visibility, userGroupIds);

  logAdminAudit(
    authContext.user!.id,
    "document_group_visibility_updated",
    "visibility",
    id,
    JSON.stringify({ visibility, userGroupIds })
  );

  return NextResponse.json({ group: updated });
}
