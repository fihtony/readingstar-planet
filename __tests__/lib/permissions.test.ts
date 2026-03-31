import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  validateCsrfToken: vi.fn(),
  logUserActivity: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: authMocks.getAuthContext,
  validateCsrfToken: authMocks.validateCsrfToken,
  logUserActivity: authMocks.logUserActivity,
}));

import { checkPermission } from "@/lib/permissions";

describe("checkPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthContext.mockResolvedValue({ user: null, sessionId: null });
    authMocks.validateCsrfToken.mockResolvedValue(true);
  });

  it("allows guest access to public GET requests", async () => {
    const request = new NextRequest("http://localhost/api/settings", {
      method: "GET",
    });

    const result = await checkPermission(request, "public");

    expect(result.authorized).toBe(true);
    expect(result.authContext.user).toBeNull();
    expect(authMocks.validateCsrfToken).not.toHaveBeenCalled();
  });

  it("rejects public writes without a valid csrf token", async () => {
    authMocks.validateCsrfToken.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/reading-sessions", {
      method: "POST",
    });

    const result = await checkPermission(request, "public");
    const body = await result.response!.json();

    expect(result.authorized).toBe(false);
    expect(result.response!.status).toBe(403);
    expect(body).toEqual({ error: "Invalid or missing CSRF token" });
  });

  it("rejects guests from authenticated routes", async () => {
    const request = new NextRequest("http://localhost/api/account/profile", {
      method: "GET",
    });

    const result = await checkPermission(request, "authenticated");
    const body = await result.response!.json();

    expect(result.authorized).toBe(false);
    expect(result.response!.status).toBe(401);
    expect(body).toEqual({ error: "Authentication required" });
  });

  it("rejects non-admin users from admin routes and logs the attempt", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      user: {
        id: "user-1",
        role: "user",
        status: "active",
      },
      sessionId: "session-1",
    });

    const request = new NextRequest("http://localhost/api/admin/users", {
      method: "GET",
    });

    const result = await checkPermission(request, "admin");
    const body = await result.response!.json();

    expect(result.authorized).toBe(false);
    expect(result.response!.status).toBe(403);
    expect(body).toEqual({ error: "Admin access required" });
    expect(authMocks.logUserActivity).toHaveBeenCalledWith(
      "user-1",
      "forbidden_action_attempt",
      expect.stringContaining('"path":"/api/admin/users"'),
      null
    );
  });
});