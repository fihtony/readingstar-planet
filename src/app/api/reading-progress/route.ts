import { NextRequest, NextResponse } from "next/server";
import {
  getReadingProgress,
  upsertReadingProgress,
} from "@/lib/repositories/reading-progress-repository";
import { checkPermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const { authContext } = await checkPermission(request, "public");
  const documentId = request.nextUrl.searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }

  if (!authContext.user) {
    return NextResponse.json({ progress: null, persisted: false });
  }

  const progress = getReadingProgress(authContext.user.id, documentId);
  return NextResponse.json({ progress });
}

export async function PUT(request: NextRequest) {
  const { authContext } = await checkPermission(request, "public");

  try {
    const body = await request.json();

    if (!body.documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    if (!authContext.user) {
      return NextResponse.json({ progress: null, persisted: false });
    }

    const progress = upsertReadingProgress({
      userId: authContext.user.id,
      documentId: body.documentId,
      currentLine: Math.max(0, Number(body.currentLine ?? 0)),
      totalLines: Math.max(0, Number(body.totalLines ?? 0)),
    });

    return NextResponse.json({ progress });
  } catch {
    return NextResponse.json(
      { error: "Invalid progress payload" },
      { status: 400 }
    );
  }
}