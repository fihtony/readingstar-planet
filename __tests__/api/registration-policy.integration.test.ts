import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import {
  createCookieStore,
  createTestDatabase,
  loadIntegrationModules,
} from "@/../__tests__/helpers/auth-integration";

describe("registration policy route integration", () => {
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

  async function loadAuthedRoute(sessionMode: "valid" | "expired" = "valid") {
    const modules = await loadIntegrationModules(testDb, cookieStore, async () => ({
      route: await import("@/app/api/admin/registration-policy/route"),
      auth: await import("@/lib/auth"),
      userRepository: await import("@/lib/repositories/user-repository"),
    }));

    const admin = modules.userRepository.createUser({
      email: "admin@example.com",
      role: "admin",
      status: "active",
      name: "Admin User",
      nickname: "Admin",
    });
    const session = modules.auth.createAuthSession(
      admin.id,
      "127.0.0.1",
      "Mozilla/5.0 Chrome/136.0"
    );

    if (sessionMode === "expired") {
      testDb
        .prepare("UPDATE auth_sessions SET expires_at = ? WHERE id = ?")
        .run("2000-01-01T00:00:00.000Z", session.id);
    }

    cookieStore.set("rs_session", session.id);
    const csrfToken = await modules.auth.generateCsrfToken();

    return { ...modules, admin, session, csrfToken };
  }

  it("returns the current registration policy for an authenticated admin and renews the session", async () => {
    const { route, session } = await loadAuthedRoute("valid");
    const originalExpiry = (
      testDb.prepare("SELECT expires_at FROM auth_sessions WHERE id = ?").get(
        session.id
      ) as { expires_at: string }
    ).expires_at;

    const response = await route.GET(
      new NextRequest("http://localhost:3000/api/admin/registration-policy")
    );
    const body = await response.json();
    const renewedExpiry = (
      testDb.prepare("SELECT expires_at FROM auth_sessions WHERE id = ?").get(
        session.id
      ) as { expires_at: string }
    ).expires_at;
    const lastSetCookie = cookieStore.getLastSet();

    expect(response.status).toBe(200);
    expect(body).toEqual({ policy: "invite-only" });
    expect(new Date(renewedExpiry).getTime()).toBeGreaterThan(
      new Date(originalExpiry).getTime()
    );
    expect(lastSetCookie?.name).toBe("rs_session");
    expect(lastSetCookie?.options?.maxAge).toBe(604800);
  });

  it("updates the registration policy and writes audit logs", async () => {
    const { route, admin, csrfToken } = await loadAuthedRoute("valid");

    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/admin/registration-policy", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ policy: "open" }),
      })
    );
    const body = await response.json();
    const policyRow = testDb
      .prepare("SELECT value FROM app_metadata WHERE key = 'registration_policy'")
      .get() as { value: string };
    const auditRow = testDb
      .prepare(
        "SELECT action, detail FROM admin_audit_log WHERE admin_user_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(admin.id) as { action: string; detail: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ policy: "open" });
    expect(policyRow.value).toBe("open");
    expect(auditRow.action).toBe("registration_policy_changed");
    expect(auditRow.detail).toContain('"from":"invite-only"');
    expect(auditRow.detail).toContain('"to":"open"');
  });

  it("rejects expired sessions on protected routes and clears the stale cookie", async () => {
    const { route, session } = await loadAuthedRoute("expired");

    const response = await route.GET(
      new NextRequest("http://localhost:3000/api/admin/registration-policy")
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Authentication required" });
    expect(cookieStore.get("rs_session")).toBeUndefined();
    expect(
      testDb.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE id = ?").get(
        session.id
      )
    ).toEqual({ count: 1 });
  });
});