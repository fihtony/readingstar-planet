import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import {
  createCookieStore,
  createTestDatabase,
  loadIntegrationModules,
} from "@/../__tests__/helpers/auth-integration";

const googleMocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  verifyIdToken: vi.fn(),
}));

describe("Google OAuth callback integration", () => {
  let testDb: Database.Database;
  let cookieStore: ReturnType<typeof createCookieStore>;

  beforeEach(() => {
    testDb = createTestDatabase();
    cookieStore = createCookieStore();

    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv(
      "GOOGLE_REDIRECT_URI",
      "http://localhost:3000/api/auth/google/callback"
    );

    googleMocks.getToken.mockResolvedValue({
      tokens: { id_token: "test-id-token" },
    });
  });

  afterEach(() => {
    testDb.close();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.doUnmock("google-auth-library");
    vi.doUnmock("@/lib/db");
    vi.doUnmock("next/headers");
  });

  async function loadRouteModules() {
    vi.doMock("google-auth-library", () => ({
      OAuth2Client: class {
        getToken = googleMocks.getToken;
        verifyIdToken = googleMocks.verifyIdToken;
      },
    }));

    return loadIntegrationModules(testDb, cookieStore, async () => ({
      route: await import("@/app/api/auth/google/callback/route"),
      auth: await import("@/lib/auth"),
      userRepository: await import("@/lib/repositories/user-repository"),
    }));
  }

  it("creates an active user and session on first login when registration is open", async () => {
    testDb
      .prepare(
        `INSERT INTO app_metadata (key, value, updated_at)
         VALUES ('registration_policy', 'open', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET value = 'open', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run();

    googleMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-user-1",
        email: "new.student@example.com",
        name: "New Student",
        picture: "https://example.com/avatar.png",
      }),
    });

    const { route } = await loadRouteModules();

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=test-code",
      {
        headers: {
          "user-agent": "Mozilla/5.0 Chrome/136.0",
          "x-real-ip": "127.0.0.1",
        },
      }
    );

    const response = await route.GET(request);
    const createdUser = testDb
      .prepare("SELECT email, role, status, google_id, nickname FROM users WHERE email = ?")
      .get("new.student@example.com") as {
      email: string;
      role: string;
      status: string;
      google_id: string;
      nickname: string;
    };
    const sessionCount = (
      testDb.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get() as {
        count: number;
      }
    ).count;

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/library");
    expect(createdUser).toMatchObject({
      email: "new.student@example.com",
      role: "user",
      status: "active",
      google_id: "google-user-1",
      nickname: "New Student",
    });
    expect(sessionCount).toBe(1);
    expect(cookieStore.get("rs_session")?.value).toBeTruthy();
  });

  it("activates a pending invited user during invite-only login", async () => {
    googleMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-user-2",
        email: "invited.student@example.com",
        name: "Invited Student",
        picture: "https://example.com/picture.png",
      }),
    });

    const { route, userRepository } = await loadRouteModules();
    userRepository.createUser({
      email: "invited.student@example.com",
      role: "user",
      status: "pending_verification",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=test-code",
      {
        headers: {
          "user-agent": "Mozilla/5.0 Safari/17.0",
          "x-real-ip": "127.0.0.1",
        },
      }
    );

    const response = await route.GET(request);
    const user = testDb
      .prepare(
        "SELECT email, status, google_id, name, avatar_url, last_login_at FROM users WHERE email = ?"
      )
      .get("invited.student@example.com") as {
      email: string;
      status: string;
      google_id: string;
      name: string;
      avatar_url: string;
      last_login_at: string | null;
    };

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/library");
    expect(user.status).toBe("active");
    expect(user.google_id).toBe("google-user-2");
    expect(user.name).toBe("Invited Student");
    expect(user.avatar_url).toBe("https://example.com/picture.png");
    expect(user.last_login_at).toBeTruthy();
  });

  it("rejects non-whitelisted users when invite-only registration is active", async () => {
    googleMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-user-3",
        email: "not.invited@example.com",
        name: "Not Invited",
        picture: "https://example.com/blocked.png",
      }),
    });

    const { route } = await loadRouteModules();

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=test-code",
      {
        headers: {
          "user-agent": "Mozilla/5.0 Firefox/137.0",
          "x-real-ip": "127.0.0.1",
        },
      }
    );

    const response = await route.GET(request);
    const userCount = (
      testDb.prepare("SELECT COUNT(*) AS count FROM users WHERE email = ?").get(
        "not.invited@example.com"
      ) as { count: number }
    ).count;
    const sessionCount = (
      testDb.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get() as {
        count: number;
      }
    ).count;

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/library?error=invite_only"
    );
    expect(userCount).toBe(0);
    expect(sessionCount).toBe(0);
    expect(cookieStore.get("rs_session")).toBeUndefined();
  });

  it("redirects to the configured production origin after login", async () => {
    vi.stubEnv(
      "GOOGLE_REDIRECT_URI",
      "https://reading.tarch.ca/api/auth/google/callback"
    );

    testDb
      .prepare(
        `INSERT INTO app_metadata (key, value, updated_at)
         VALUES ('registration_policy', 'open', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET value = 'open', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run();

    googleMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-user-4",
        email: "production.student@example.com",
        name: "Production Student",
        picture: "https://example.com/production.png",
      }),
    });

    const { route } = await loadRouteModules();

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=test-code",
      {
        headers: {
          "user-agent": "Mozilla/5.0 Chrome/136.0",
          "x-real-ip": "127.0.0.1",
        },
      }
    );

    const response = await route.GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://reading.tarch.ca/library");
  });
});