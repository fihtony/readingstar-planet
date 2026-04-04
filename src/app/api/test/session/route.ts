import { NextRequest, NextResponse } from "next/server";
import {
  createAuthSession,
  generateCsrfToken,
  getUserByEmail,
  setSessionCookie,
} from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { getClientIp } from "@/lib/permissions";
import { createUser, updateUser } from "@/lib/repositories/user-repository";
import type { User, UserRole, UserStatus } from "@/types";

// Test auth is completely disabled in production regardless of any env var.
const TEST_AUTH_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.READINGSTAR_ENABLE_TEST_AUTH === "1";

type SessionSeedInput = {
  email: string;
  role?: UserRole;
  status?: UserStatus;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  adminNotes?: string;
  redirectTo?: string;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function normalizeRole(value: string | null | undefined): UserRole {
  return value === "admin" ? "admin" : "user";
}

function normalizeStatus(value: string | null | undefined): UserStatus {
  if (
    value === "inactive" ||
    value === "deleted" ||
    value === "pending_verification"
  ) {
    return value;
  }
  return "active";
}

function normalizeRedirectTarget(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) {
    return "/library";
  }
  return value;
}

async function parseRequestBody(request: NextRequest): Promise<SessionSeedInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return {
      email: String(body.email ?? "").trim(),
      role: normalizeRole(String(body.role ?? "user")),
      status: normalizeStatus(String(body.status ?? "active")),
      name: String(body.name ?? "").trim(),
      nickname: String(body.nickname ?? "").trim(),
      avatarUrl: String(body.avatarUrl ?? "").trim(),
      adminNotes: String(body.adminNotes ?? "").trim(),
      redirectTo: normalizeRedirectTarget(String(body.redirectTo ?? "/library")),
    };
  }

  const formData = await request.formData();
  return {
    email: String(formData.get("email") ?? "").trim(),
    role: normalizeRole(String(formData.get("role") ?? "user")),
    status: normalizeStatus(String(formData.get("status") ?? "active")),
    name: String(formData.get("name") ?? "").trim(),
    nickname: String(formData.get("nickname") ?? "").trim(),
    avatarUrl: String(formData.get("avatarUrl") ?? "").trim(),
    adminNotes: String(formData.get("adminNotes") ?? "").trim(),
    redirectTo: normalizeRedirectTarget(String(formData.get("redirectTo") ?? "/library")),
  };
}

function readSearchParams(request: NextRequest): SessionSeedInput {
  const searchParams = request.nextUrl.searchParams;
  return {
    email: searchParams.get("email")?.trim() ?? "",
    role: normalizeRole(searchParams.get("role")),
    status: normalizeStatus(searchParams.get("status")),
    name: searchParams.get("name")?.trim() ?? "",
    nickname: searchParams.get("nickname")?.trim() ?? "",
    avatarUrl: searchParams.get("avatarUrl")?.trim() ?? "",
    adminNotes: searchParams.get("adminNotes")?.trim() ?? "",
    redirectTo: normalizeRedirectTarget(searchParams.get("redirectTo")),
  };
}

function ensureUser(input: SessionSeedInput): User {
  const existing = getUserByEmail(input.email);

  if (!existing) {
    return createUser({
      email: input.email,
      role: input.role,
      status: input.status,
      name: input.name,
      nickname: input.nickname || input.name || input.email.split("@")[0],
      avatarUrl: input.avatarUrl,
      adminNotes: input.adminNotes,
      googleId: `test-google:${input.email}`,
    });
  }

  return updateUser(existing.id, {
    role: input.role,
    status: input.status,
    name: input.name || existing.name,
    nickname:
      input.nickname || existing.nickname || input.name || existing.email.split("@")[0],
    avatarUrl: input.avatarUrl || existing.avatarUrl,
    avatarSource: input.avatarUrl ? "custom" : existing.avatarSource,
    adminNotes: input.adminNotes || existing.adminNotes,
    googleId: existing.googleId ?? `test-google:${existing.email}`,
    lastLoginAt: new Date().toISOString(),
  })!;
}

async function issueSession(request: NextRequest, input: SessionSeedInput) {
  if (!input.email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = ensureUser(input);
  const session = createAuthSession(
    user.id,
    getClientIp(request),
    request.headers.get("user-agent") ?? "Playwright Test Browser"
  );

  await setSessionCookie(session.id);
  const csrfToken = await generateCsrfToken();

  return { user, csrfToken };
}

export async function GET(request: NextRequest) {
  if (!TEST_AUTH_ENABLED) {
    return notFoundResponse();
  }

  const input = readSearchParams(request);
  const result = await issueSession(request, input);

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.redirect(getAppUrl(request, input.redirectTo ?? "/library"));
}

export async function POST(request: NextRequest) {
  if (!TEST_AUTH_ENABLED) {
    return notFoundResponse();
  }

  const input = await parseRequestBody(request);
  const result = await issueSession(request, input);

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json({ user: result.user, csrfToken: result.csrfToken });
}