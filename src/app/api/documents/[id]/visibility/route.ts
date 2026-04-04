import { NextRequest, NextResponse } from "next/server";
import {
  getDocumentById,
  setDocumentVisibility,
} from "@/lib/repositories/document-repository";
import { getUserGroupById } from "@/lib/repositories/user-group-repository";
import { checkPermission } from "@/lib/permissions";
import { logAdminAudit } from "@/lib/auth";
import type { VisibilityType } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_VISIBILITY: VisibilityType[] = ["public", "admin_only", "user_groups"];

/** PATCH /api/documents/[id]/visibility */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "admin"
  );
  if (!authorized) return response;

  const { id } = await params;

  const doc = getDocumentById(id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accessOverride = body.accessOverride as boolean | undefined;
  if (typeof accessOverride !== "boolean") {
    return NextResponse.json(
      { error: "accessOverride must be a boolean" },
      { status: 400 }
    );
  }

  const visibility = (body.visibility as VisibilityType | undefined) ?? "public";
  if (!VALID_VISIBILITY.includes(visibility)) {
    return NextResponse.json(
      { error: `visibility must be one of: ${VALID_VISIBILITY.join(", ")}` },
      { status: 400 }
    );
  }

  const userGroupIds = (body.userGroupIds as string[] | undefined) ?? [];

  if (accessOverride && visibility === "user_groups" && userGroupIds.length === 0) {
    return NextResponse.json(
      { error: "userGroupIds is required when visibility = user_groups" },
      { status: 422 }
    );
  }

  // Validate that all referenced user groups exist
  if (accessOverride && visibility === "user_groups") {
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

  const updated = setDocumentVisibility(id, accessOverride, visibility, userGroupIds);

  logAdminAudit(
    authContext.user!.id,
    "document_visibility_updated",
    "visibility",
    id,
    JSON.stringify({ accessOverride, visibility, userGroupIds })
  );

  return NextResponse.json({ document: updated });
}
