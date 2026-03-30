import { NextRequest, NextResponse } from "next/server";
import {
  getReadingProgress,
  upsertReadingProgress,
} from "@/lib/repositories/reading-progress-repository";

const DEFAULT_USER_ID = "default-user";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
  const documentId = request.nextUrl.searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }

  const progress = getReadingProgress(userId, documentId);
  return NextResponse.json({ progress });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId ?? DEFAULT_USER_ID;

    if (!body.documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const progress = upsertReadingProgress({
      userId,
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