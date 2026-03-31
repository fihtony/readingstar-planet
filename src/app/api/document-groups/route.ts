import { NextRequest, NextResponse } from "next/server";
import {
  createDocumentGroup,
  ensureDefaultDocumentGroup,
  listDocumentGroups,
  reorderDocumentGroups,
  renameDocumentGroup,
} from "@/lib/repositories/document-group-repository";

const DEFAULT_USER_ID = "default-user";

export async function GET() {
  ensureDefaultDocumentGroup(DEFAULT_USER_ID);
  return NextResponse.json({
    groups: listDocumentGroups(DEFAULT_USER_ID),
  });
}

export async function POST(request: NextRequest) {
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
      userId: DEFAULT_USER_ID,
      name,
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ group });
    }

    const orderedGroupIds = body.orderedGroupIds as string[] | undefined;

    if (!Array.isArray(orderedGroupIds) || orderedGroupIds.length === 0) {
      return NextResponse.json(
        { error: "orderedGroupIds is required" },
        { status: 400 }
      );
    }

    const groups = reorderDocumentGroups(DEFAULT_USER_ID, orderedGroupIds);
    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}