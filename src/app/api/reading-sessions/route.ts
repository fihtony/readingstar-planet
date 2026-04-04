import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  endSession,
  getSessionById,
  getSessionsByUser,
} from "@/lib/repositories/session-repository";
import { checkPermission } from "@/lib/permissions";
import { recordReadingTime } from "@/lib/repositories/reading-stats-repository";

export async function GET(request: NextRequest) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "authenticated"
  );
  if (!authorized) {
    return response;
  }

  const sessions = getSessionsByUser(authContext.user!.id);
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, response, authContext } = await checkPermission(request, "public");
    if (!authorized) return response!
    const body = await request.json();
    const { sessionId, documentId, focusMode, letterHelperEnabled, ttsUsed } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    if (!authContext.user) {
      const guestSessionId =
        typeof sessionId === "string" && sessionId.trim().length > 0
          ? sessionId
          : randomUUID();
      const startedAt = new Date().toISOString();

      return NextResponse.json(
        {
          session: {
            id: guestSessionId,
            userId: "guest",
            documentId,
            startedAt,
            endedAt: null,
            focusMode: focusMode || "single-line",
            letterHelperEnabled: letterHelperEnabled ?? false,
            ttsUsed: ttsUsed ?? false,
            linesRead: 0,
          },
          persisted: false,
        },
        { status: 201 }
      );
    }

    if (typeof sessionId === "string") {
      const existing = getSessionById(sessionId);
      if (existing && existing.userId !== authContext.user.id) {
        return NextResponse.json(
          { error: "Session id is already in use" },
          { status: 409 }
        );
      }
    }

    const session = createSession({
      id: sessionId,
      userId: authContext.user.id,
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
    const { authorized, response, authContext } = await checkPermission(request, "public");
    if (!authorized) return response!
    const body = await request.json();
    const { sessionId, linesRead, focusMode, letterHelperEnabled, ttsUsed } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    if (!authContext.user) {
      return NextResponse.json({ session: null, persisted: false });
    }

    const existing = getSessionById(sessionId);
    if (!existing || existing.userId !== authContext.user.id) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
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

    // Record reading time for authenticated users (§6.1: guests don't get stats)
    if (session.endedAt && session.startedAt) {
      const durationMs =
        new Date(session.endedAt).getTime() -
        new Date(session.startedAt).getTime();
      const durationSec = Math.max(0, Math.round(durationMs / 1000));
      if (durationSec > 0) {
        recordReadingTime(
          authContext.user.id,
          session.documentId,
          durationSec
        );
      }
    }

    return NextResponse.json({ session });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
