import { NextRequest, NextResponse } from "next/server";
import { createSession, endSession, getSessionsByUser } from "@/lib/repositories/session-repository";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const sessions = getSessionsByUser(userId);
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId, documentId, focusMode, letterHelperEnabled, ttsUsed } = body;

    if (!userId || !documentId) {
      return NextResponse.json(
        { error: "userId and documentId are required" },
        { status: 400 }
      );
    }

    const session = createSession({
      id: sessionId,
      userId,
      documentId,
      focusMode: focusMode || "single-line",
      letterHelperEnabled: letterHelperEnabled ?? false,
      ttsUsed: ttsUsed ?? false,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, linesRead, focusMode, letterHelperEnabled, ttsUsed } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const session = endSession(sessionId, linesRead ?? 0, {
      focusMode,
      letterHelperEnabled,
      ttsUsed,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
