import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import {
  createCookieStore,
  createTestDatabase,
  loadIntegrationModules,
} from "@/../__tests__/helpers/auth-integration";

describe("admin user lifecycle integration", () => {
  let testDb: Database.Database;
  let cookieStore: ReturnType<typeof createCookieStore>;

  beforeEach(() => {
    testDb = createTestDatabase();
    cookieStore = createCookieStore();
  });

  afterEach(() => {
    testDb.close();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/db");
    vi.doUnmock("next/headers");
  });

  async function loadAuthedRoutes() {
    const modules = await loadIntegrationModules(testDb, cookieStore, async () => ({
      adminUserRoute: await import("@/app/api/admin/users/[id]/route"),
      restoreRoute: await import("@/app/api/admin/users/[id]/restore/route"),
      forceLogoutRoute: await import(
        "@/app/api/admin/users/[id]/force-logout/route"
      ),
      selfDeleteRoute: await import("@/app/api/auth/account/route"),
      auth: await import("@/lib/auth"),
      userRepository: await import("@/lib/repositories/user-repository"),
    }));

    const admin = modules.userRepository.createUser({
      email: "admin@example.com",
      role: "admin",
      status: "active",
      name: "Admin",
      nickname: "Admin",
    });
    const session = modules.auth.createAuthSession(
      admin.id,
      "127.0.0.1",
      "Mozilla/5.0 Chrome/136.0"
    );
    cookieStore.set("rs_session", session.id);
    const csrfToken = await modules.auth.generateCsrfToken();

    return { ...modules, admin, csrfToken };
  }

  function patchRequest(body: Record<string, unknown>, csrfToken: string) {
    return new NextRequest("http://localhost:3000/api/admin/users/target", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(body),
    });
  }

  it("prevents an admin from demoting themselves", async () => {
    const { adminUserRoute, admin, csrfToken } = await loadAuthedRoutes();

    const response = await adminUserRoute.PATCH(patchRequest({ role: "user" }, csrfToken), {
      params: Promise.resolve({ id: admin.id }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Cannot demote yourself from admin" });
  });

  it("prevents an admin from deleting themselves via the admin route", async () => {
    const { adminUserRoute, admin, csrfToken } = await loadAuthedRoutes();

    const response = await adminUserRoute.DELETE(
      new NextRequest("http://localhost:3000/api/admin/users/self", {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      }),
      {
        params: Promise.resolve({ id: admin.id }),
      }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Cannot delete yourself" });
  });

  it("prevents an admin from self-deleting through the account endpoint", async () => {
    const { selfDeleteRoute, csrfToken } = await loadAuthedRoutes();

    const response = await selfDeleteRoute.DELETE(
      new NextRequest("http://localhost:3000/api/auth/account", {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "Admins cannot delete their own account via this endpoint",
    });
  });

  it("deactivates a target user and invalidates all of their sessions", async () => {
    const { adminUserRoute, auth, userRepository, csrfToken } = await loadAuthedRoutes();
    const target = userRepository.createUser({
      email: "student@example.com",
      role: "user",
      status: "active",
      name: "Student",
    });

    auth.createAuthSession(target.id, "127.0.0.2", "Mozilla/5.0 Chrome/136.0");
    auth.createAuthSession(target.id, "127.0.0.3", "Mozilla/5.0 Safari/17.0");

    const response = await adminUserRoute.PATCH(
      patchRequest({ status: "inactive" }, csrfToken),
      {
        params: Promise.resolve({ id: target.id }),
      }
    );
    const body = await response.json();
    const sessionCount = (
      testDb
        .prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id = ?")
        .get(target.id) as { count: number }
    ).count;

    expect(response.status).toBe(200);
    expect(body.user.status).toBe("inactive");
    expect(sessionCount).toBe(0);
  });

  it("restores a deleted user and clears deleted_at", async () => {
    const { restoreRoute, userRepository, csrfToken } = await loadAuthedRoutes();
    const target = userRepository.createUser({
      email: "restore-me@example.com",
      role: "user",
      status: "deleted",
      name: "Restore Me",
    });

    const response = await restoreRoute.POST(
      new NextRequest("http://localhost:3000/api/admin/users/restore", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      }),
      {
        params: Promise.resolve({ id: target.id }),
      }
    );
    const body = await response.json();
    const restoredRow = testDb
      .prepare("SELECT status, deleted_at FROM users WHERE id = ?")
      .get(target.id) as { status: string; deleted_at: string | null };

    expect(response.status).toBe(200);
    expect(body.user.status).toBe("active");
    expect(restoredRow).toEqual({ status: "active", deleted_at: null });
  });

  it("forces logout for all sessions belonging to the target user", async () => {
    const { forceLogoutRoute, auth, userRepository, csrfToken } = await loadAuthedRoutes();
    const target = userRepository.createUser({
      email: "logout-me@example.com",
      role: "user",
      status: "active",
      name: "Logout Me",
    });

    auth.createAuthSession(target.id, "127.0.0.2", "Mozilla/5.0 Chrome/136.0");
    auth.createAuthSession(target.id, "127.0.0.3", "Mozilla/5.0 Safari/17.0");

    const response = await forceLogoutRoute.POST(
      new NextRequest("http://localhost:3000/api/admin/users/force-logout", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      }),
      {
        params: Promise.resolve({ id: target.id }),
      }
    );
    const body = await response.json();
    const sessionCount = (
      testDb
        .prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id = ?")
        .get(target.id) as { count: number }
    ).count;

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(sessionCount).toBe(0);
  });
});