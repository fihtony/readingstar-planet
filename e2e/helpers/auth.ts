import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type TestSessionOptions = {
  email: string;
  role?: "admin" | "user";
  status?: "active" | "inactive" | "deleted" | "pending_verification";
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  adminNotes?: string;
  redirectTo?: string;
};

const DEFAULT_ADMIN_SESSION: TestSessionOptions = {
  email: "admin.e2e@example.com",
  role: "admin",
  status: "active",
  name: "E2E Admin",
  nickname: "E2E Admin",
  redirectTo: "/library",
};

function buildSessionQuery(options: TestSessionOptions) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(options)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return searchParams.toString();
}

export function uniqueTitle(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function loginPageAs(page: Page, options: TestSessionOptions) {
  const query = buildSessionQuery({ redirectTo: "/library", ...options });
  await page.goto(`/api/test/session?${query}`);
  await expect(page).toHaveURL(/\/library/);
}

export async function loginPageAsAdmin(
  page: Page,
  overrides: Partial<TestSessionOptions> = {}
) {
  await loginPageAs(page, { ...DEFAULT_ADMIN_SESSION, ...overrides });
}

export async function loginApiAs(
  request: APIRequestContext,
  options: TestSessionOptions
) {
  const response = await request.post("/api/test/session", {
    data: { redirectTo: "/library", ...options },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    user: { id: string; email: string };
    csrfToken: string;
  };
}

export async function loginApiAsAdmin(
  request: APIRequestContext,
  overrides: Partial<TestSessionOptions> = {}
) {
  return loginApiAs(request, { ...DEFAULT_ADMIN_SESSION, ...overrides });
}

export async function resetDocuments(request: APIRequestContext) {
  const { csrfToken } = await loginApiAsAdmin(request);
  const response = await request.get("/api/documents");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  for (const document of payload.documents as Array<{ id: string }>) {
    const deleteResponse = await request.delete(
      `/api/documents?id=${document.id}`,
      {
        headers: { "x-csrf-token": csrfToken },
      }
    );
    expect(deleteResponse.ok()).toBeTruthy();
  }
}

export async function createDocumentViaApi(
  request: APIRequestContext,
  title: string,
  content: string
) {
  const { csrfToken } = await loginApiAsAdmin(request);
  const response = await request.post("/api/documents", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      title,
      content,
      groupId: null,
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.document as { id: string; title: string };
}

export async function createGroupViaApi(
  request: APIRequestContext,
  name: string
) {
  const { csrfToken } = await loginApiAsAdmin(request);
  const response = await request.post("/api/document-groups", {
    headers: { "x-csrf-token": csrfToken },
    data: { name },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.group as { id: string; name: string };
}