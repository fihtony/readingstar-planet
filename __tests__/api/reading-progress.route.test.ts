import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const routeMocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  getReadingProgress: vi.fn(),
  upsertReadingProgress: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: routeMocks.checkPermission,
}));

vi.mock("@/lib/repositories/reading-progress-repository", () => ({
  getReadingProgress: routeMocks.getReadingProgress,
  upsertReadingProgress: routeMocks.upsertReadingProgress,
}));

import { GET, PUT } from "@/app/api/reading-progress/route";

describe("reading-progress route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns non-persisted progress for guests without touching the repository", async () => {
    routeMocks.checkPermission.mockResolvedValue({
      authContext: { user: null },
    });

    const request = new NextRequest(
      "http://localhost/api/reading-progress?documentId=doc-1"
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ progress: null, persisted: false });
    expect(routeMocks.getReadingProgress).not.toHaveBeenCalled();
  });

  it("treats guest progress writes as a no-op", async () => {
    routeMocks.checkPermission.mockResolvedValue({
      authContext: { user: null },
    });

    const request = new NextRequest("http://localhost/api/reading-progress", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-1",
        currentLine: 8,
        totalLines: 24,
      }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ progress: null, persisted: false });
    expect(routeMocks.upsertReadingProgress).not.toHaveBeenCalled();
  });

  it("persists authenticated progress under the current user instead of any spoofed body value", async () => {
    const progress = {
      userId: "real-user",
      documentId: "doc-1",
      currentLine: 12,
      totalLines: 40,
      updatedAt: "2026-03-31T12:00:00.000Z",
    };

    routeMocks.checkPermission.mockResolvedValue({
      authContext: {
        user: { id: "real-user" },
      },
    });
    routeMocks.upsertReadingProgress.mockReturnValue(progress);

    const request = new NextRequest("http://localhost/api/reading-progress", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "spoofed-user",
        documentId: "doc-1",
        currentLine: 12,
        totalLines: 40,
      }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(routeMocks.upsertReadingProgress).toHaveBeenCalledWith({
      userId: "real-user",
      documentId: "doc-1",
      currentLine: 12,
      totalLines: 40,
    });
    expect(body).toEqual({ progress });
  });
});