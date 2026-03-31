import { randomBytes, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { getDatabase } from "./db";
import type { User, AuthSession, DeviceType } from "@/types";

const SESSION_COOKIE_NAME = "rs_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function shouldUseSecureCookies(): boolean {
  return (
    process.env.NODE_ENV === "production"
    && process.env.READINGSTAR_ENABLE_TEST_AUTH !== "1"
  );
}

// ─── User-Agent parsing helpers ──────────────────────────────────────────────

interface ParsedUA {
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: DeviceType;
  deviceModel: string;
}

export function parseUserAgent(ua: string): ParsedUA {
  const result: ParsedUA = {
    browserName: "",
    browserVersion: "",
    osName: "",
    osVersion: "",
    deviceType: "unknown",
    deviceModel: "",
  };

  if (!ua) return result;

  // OS detection
  if (/Windows NT (\d+[\d.]*)/i.test(ua)) {
    result.osName = "Windows";
    result.osVersion = RegExp.$1;
    result.deviceType = "desktop";
  } else if (/Mac OS X (\d+[._\d]*)/i.test(ua)) {
    result.osName = "macOS";
    result.osVersion = RegExp.$1.replace(/_/g, ".");
    result.deviceType = "desktop";
  } else if (/Android (\d+[\d.]*)/i.test(ua)) {
    result.osName = "Android";
    result.osVersion = RegExp.$1;
    result.deviceType = /mobile/i.test(ua) ? "mobile" : "tablet";
  } else if (/iPhone|iPod/.test(ua)) {
    result.osName = "iOS";
    const m = ua.match(/OS (\d+[_.\d]*)/);
    if (m) result.osVersion = m[1].replace(/_/g, ".");
    result.deviceType = "mobile";
  } else if (/iPad/.test(ua)) {
    result.osName = "iPadOS";
    const m = ua.match(/OS (\d+[_.\d]*)/);
    if (m) result.osVersion = m[1].replace(/_/g, ".");
    result.deviceType = "tablet";
  } else if (/Linux/i.test(ua)) {
    result.osName = "Linux";
    result.deviceType = "desktop";
  } else if (/bot|crawl|spider/i.test(ua)) {
    result.deviceType = "bot";
  }

  // Browser detection
  if (/Edg\/(\d+[\d.]*)/i.test(ua)) {
    result.browserName = "Edge";
    result.browserVersion = RegExp.$1;
  } else if (/Chrome\/(\d+[\d.]*)/i.test(ua)) {
    result.browserName = "Chrome";
    result.browserVersion = RegExp.$1;
  } else if (/Firefox\/(\d+[\d.]*)/i.test(ua)) {
    result.browserName = "Firefox";
    result.browserVersion = RegExp.$1;
  } else if (/Safari\/(\d+[\d.]*)/.test(ua) && /Version\/(\d+[\d.]*)/.test(ua)) {
    result.browserName = "Safari";
    result.browserVersion = RegExp.$1;
  }

  return result;
}

// ─── Session management ──────────────────────────────────────────────────────

function generateSessionId(): string {
  return randomBytes(32).toString("hex"); // 256 bits of entropy
}

interface UserRow {
  id: string;
  google_id: string | null;
  email: string;
  name: string;
  nickname: string;
  avatar_url: string;
  avatar_source: string;
  personal_note: string;
  role: string;
  status: string;
  admin_notes: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    avatarSource: row.avatar_source as User["avatarSource"],
    personalNote: row.personal_note,
    role: row.role as User["role"],
    status: row.status as User["status"],
    adminNotes: row.admin_notes,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function getUserById(id: string): User | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserByGoogleId(googleId: string): User | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserByEmail(email: string): User | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function createAuthSession(
  userId: string,
  ipAddress: string | null,
  userAgent: string
): AuthSession {
  const db = getDatabase();
  const id = generateSessionId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const parsed = parseUserAgent(userAgent);

  db.prepare(
    `INSERT INTO auth_sessions (id, user_id, ip_address, raw_user_agent, browser_name, browser_version, os_name, os_version, device_type, device_model, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, userId, ipAddress, userAgent,
    parsed.browserName, parsed.browserVersion,
    parsed.osName, parsed.osVersion,
    parsed.deviceType, parsed.deviceModel,
    now, now, expiresAt
  );

  return {
    id,
    userId,
    ipAddress,
    rawUserAgent: userAgent,
    browserName: parsed.browserName,
    browserVersion: parsed.browserVersion,
    osName: parsed.osName,
    osVersion: parsed.osVersion,
    deviceType: parsed.deviceType as DeviceType,
    deviceModel: parsed.deviceModel,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  };
}

export function getAuthSession(sessionId: string): AuthSession | null {
  const db = getDatabase();
  const row = db.prepare(
    "SELECT * FROM auth_sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(sessionId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    ipAddress: row.ip_address as string | null,
    rawUserAgent: row.raw_user_agent as string,
    browserName: row.browser_name as string,
    browserVersion: row.browser_version as string,
    osName: row.os_name as string,
    osVersion: row.os_version as string,
    deviceType: row.device_type as DeviceType,
    deviceModel: row.device_model as string,
    createdAt: row.created_at as string,
    lastSeenAt: row.last_seen_at as string,
    expiresAt: row.expires_at as string,
  };
}

export function renewSession(sessionId: string): void {
  const db = getDatabase();
  const newExpiry = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  db.prepare(
    "UPDATE auth_sessions SET last_seen_at = datetime('now'), expires_at = ? WHERE id = ?"
  ).run(newExpiry, sessionId);
}

export function deleteSession(sessionId: string): void {
  const db = getDatabase();
  db.prepare("DELETE FROM auth_sessions WHERE id = ?").run(sessionId);
}

export function deleteAllUserSessions(userId: string): void {
  const db = getDatabase();
  db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(userId);
}

// ─── Request context helper ──────────────────────────────────────────────────

export interface AuthContext {
  user: User | null;
  sessionId: string | null;
}

/**
 * Get the current authenticated user from the request cookie.
 * Returns { user: null, sessionId: null } for guests.
 * Automatically renews valid sessions (sliding expiry).
 */
export async function getAuthContext(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) {
    return { user: null, sessionId: null };
  }

  const session = getAuthSession(sessionCookie.value);
  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return { user: null, sessionId: null };
  }

  const user = getUserById(session.userId);
  if (!user || user.status !== "active") {
    // Invalid or inactive user – clean up session
    deleteSession(session.id);
    cookieStore.delete(SESSION_COOKIE_NAME);
    return { user: null, sessionId: null };
  }

  // Sliding window renewal
  renewSession(session.id);
  await setSessionCookie(session.id);

  return { user, sessionId: session.id };
}

/**
 * Set the session cookie after successful login.
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

/**
 * Clear the session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// ─── CSRF Token helpers ──────────────────────────────────────────────────────

const CSRF_COOKIE_NAME = "rs_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JS needs to read this
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return token;
}

export async function validateCsrfToken(headerToken: string | null): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieToken || !headerToken) return false;
  // Constant-time comparison
  if (cookieToken.length !== headerToken.length) return false;
  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return result === 0;
}

// ─── Rate limiting (in-memory, per-process) ──────────────────────────────────

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= 10;
}

// ─── Activity & Audit logging ────────────────────────────────────────────────

export function logUserActivity(
  userId: string,
  action: string,
  detail: string = "",
  ipAddress: string | null = null
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO user_activity_log (id, user_id, action, detail, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(randomUUID(), userId, action, detail, ipAddress);
}

export function logAdminAudit(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  detail: string = ""
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO admin_audit_log (id, admin_user_id, action, target_type, target_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(randomUUID(), adminUserId, action, targetType, targetId, detail);
}

// ─── User display name helper ────────────────────────────────────────────────

export function getDisplayName(user: User): string {
  return user.nickname || user.name || user.email;
}
