import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const routeMocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  createSession: vi.fn(),
  endSession: vi.fn(),
  getSessionById: vi.fn(),
  getSessionsByUser: vi.fn(),
  recordReadingTime: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: routeMocks.checkPermission,
}));

vi.mock("@/lib/repositories/session-repository", () => ({
  createSession: routeMocks.createSession,
  endSession: routeMocks.endSession,
  getSessionById: routeMocks.getSessionById,
  getSessionsByUser: routeMocks.getSessionsByUser,
}));

vi.mock("@/lib/repositories/reading-stats-repository", () => ({
  recordReadingTime: routeMocks.recordReadingTime,
}));

import { PATCH, POST } from "@/app/api/reading-sessions/route";

describe("reading-sessions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a synthetic guest session instead of writing to the database", async () => {
    routeMocks.checkPermission.mockResolvedValue({
      authorized: true,
      authContext: { user: null },
    });

    const request = new NextRequest("http://localhost/api/reading-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "guest-session-1",
        userId: "spoofed-user",
        documentId: "doc-1",
        focusMode: "karaoke",
        letterHelperEnabled: true,
        ttsUsed: false,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.persisted).toBe(false);
    expect(body.session.id).toBe("guest-session-1");
    expect(body.session.userId).toBe("guest");
    expect(routeMocks.createSession).not.toHaveBeenCalled();
  });

  it("creates authenticated sessions under the current user even if the body is spoofed", async () => {
    const createdSession = {
      id: "session-1",
      userId: "real-user",
      documentId: "doc-1",
      startedAt: "2026-03-31T12:00:00.000Z",
      endedAt: null,
      focusMode: "single-line",
      letterHelperEnabled: false,
      ttsUsed: true,
      linesRead: 0,
    };

    routeMocks.checkPermission.mockResolvedValue({
      authorized: true,
      authContext: { user: { id: "real-user" } },
    });
    routeMocks.getSessionById.mockReturnValue(null);
    routeMocks.createSession.mockReturnValue(createdSession);

    const request = new NextRequest("http://localhost/api/reading-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        userId: "spoofed-user",
        documentId: "doc-1",
        focusMode: "single-line",
        letterHelperEnabled: false,
        ttsUsed: true,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(routeMocks.createSession).toHaveBeenCalledWith({
      id: "session-1",
      userId: "real-user",
      documentId: "doc-1",
      focusMode: "single-line",
      letterHelperEnabled: false,
      ttsUsed: true,
    });
    expect(body).toEqual({ session: createdSession });
  });

  it("rejects session id reuse across different users", async () => {
    routeMocks.checkPermission.mockResolvedValue({
      authorized: true,
      authContext: { user: { id: "real-user" } },
    });
    routeMocks.getSessionById.mockReturnValue({
      id: "session-1",
      userId: "other-user",
    });

    const request = new NextRequest("http://localhost/api/reading-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        documentId: "doc-1",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Session id is already in use" });
    expect(routeMocks.createSession).not.toHaveBeenCalled();
  });

  it("treats guest session completion as a no-op", async () => {
    routeMocks.checkPermission.mockResolvedValue({
      authContext: { user: null },
    });

    const request = new NextRequest("http://localhost/api/reading-sessions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "guest-session-1", linesRead: 15 }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(body).toEqual({ session: null, persisted: false });
    expect(routeMocks.endSession).not.toHaveBeenCalled();
    expect(routeMocks.recordReadingTime).not.toHaveBeenCalled();
  });

  it("rejects attempts to finish another user's session", async () => {
    routeMocks.checkPermission.mockResolvedValue({
      authContext: { user: { id: "real-user" } },
    });
    routeMocks.getSessionById.mockReturnValue({
      id: "session-1",
      userId: "other-user",
      documentId: "doc-1",
      startedAt: "2026-03-31T12:00:00.000Z",
      endedAt: null,
    });

    const request = new NextRequest("http://localhost/api/reading-sessions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "session-1", linesRead: 25 }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Session not found" });
    expect(routeMocks.endSession).not.toHaveBeenCalled();
    expect(routeMocks.recordReadingTime).not.toHaveBeenCalled();
  });
});