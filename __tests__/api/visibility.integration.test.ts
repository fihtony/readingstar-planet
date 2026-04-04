/**
 * Integration tests for visibility-related API endpoints.
 *
 * Covers test cases from docs/06_document_access_control.md Section 9.2:
 *   API-UG-07  - Admin PATCH group visibility → 200
 *   API-UG-08  - PATCH group visibility=user_groups without userGroupIds → 422
 *   API-UG-09  - Non-admin PATCH document visibility → 403
 *   API-UG-10  - Admin PATCH document visibility override → 200
 *   API-UG-11  - PATCH document visibility=user_groups without userGroupIds → 422
 *   API-UG-12  - PATCH document visibility=user_groups with non-existent group → 404
 *   API-UG-13  - Guest GET public book/group list returns 200
 *   API-UG-14  - Guest GET unauthorized book → 404
 *   API-UG-15  - Admin DELETE group with books → 409
 *   API-UG-16  - List / search returns no unauthorized content
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  getDocumentGroupById: vi.fn(),
  setDocumentGroupVisibility: vi.fn(),
  deleteDocumentGroup: vi.fn(),
  listDocumentGroupsWithVisibility: vi.fn(),
  getDocumentById: vi.fn(),
  setDocumentVisibility: vi.fn(),
  listDocuments: vi.fn(),
  searchDocuments: vi.fn(),
  getDocumentUserGroupIds: vi.fn(),
  moveDocumentWithVisibilityHandling: vi.fn(),
  getUserGroupById: vi.fn(),
  getUserGroupIds: vi.fn(),
  getUserStatsMap: vi.fn(),
  getAuthContext: vi.fn(),
  logAdminAudit: vi.fn(),
  logUserActivity: vi.fn(),
  canViewerSeeDocument: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/repositories/document-group-repository", () => ({
  getDocumentGroupById: mocks.getDocumentGroupById,
  setDocumentGroupVisibility: mocks.setDocumentGroupVisibility,
  deleteDocumentGroup: mocks.deleteDocumentGroup,
  listDocumentGroupsWithVisibility: mocks.listDocumentGroupsWithVisibility,
}));

vi.mock("@/lib/repositories/document-repository", () => ({
  getDocumentById: mocks.getDocumentById,
  setDocumentVisibility: mocks.setDocumentVisibility,
  listDocuments: mocks.listDocuments,
  searchDocuments: mocks.searchDocuments,
  getDocumentUserGroupIds: mocks.getDocumentUserGroupIds,
  moveDocumentWithVisibilityHandling: mocks.moveDocumentWithVisibilityHandling,
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
  incrementDocumentReadCount: vi.fn(),
}));

vi.mock("@/lib/repositories/user-group-repository", () => ({
  getUserGroupById: mocks.getUserGroupById,
  getUserGroupIds: mocks.getUserGroupIds,
}));

vi.mock("@/lib/repositories/reading-stats-repository", () => ({
  recordUserRead: vi.fn(),
  getUserStatsMap: mocks.getUserStatsMap,
}));

vi.mock("@/lib/visibility", () => ({
  canViewerSeeDocument: mocks.canViewerSeeDocument,
  canViewerSeeGroup: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: mocks.getAuthContext,
  logAdminAudit: mocks.logAdminAudit,
  logUserActivity: mocks.logUserActivity,
}));

vi.mock("@/lib/pdf-parser", () => ({
  validateFile: vi.fn(),
  extractTextFromTXT: vi.fn(),
  titleFromFilename: vi.fn(),
}));

vi.mock("@/lib/pdf-parser.server", () => ({
  extractTextFromPDF: vi.fn(),
}));

vi.mock("@/lib/text-processor", () => ({
  sanitizeTextContent: vi.fn((v: string) => v),
}));

// Import route handlers after mocks
import { PATCH as groupVisibilityPATCH } from "@/app/api/document-groups/[id]/visibility/route";
import { DELETE as documentGroupDELETE, GET as documentGroupListGET } from "@/app/api/document-groups/route";
import { PATCH as documentVisibilityPATCH } from "@/app/api/documents/[id]/visibility/route";
import { GET as documentsGET } from "@/app/api/documents/route";

// ── Helpers ────────────────────────────────────────────────────────────────

const ADMIN_AUTH = {
  authorized: true,
  response: undefined,
  authContext: { user: { id: "admin-1", role: "admin", status: "active" } },
};

const USER_AUTH = {
  authorized: false,
  response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
  authContext: { user: { id: "user-1", role: "user", status: "active" } },
};

const GUEST_AUTH = {
  authorized: false,
  response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  authContext: { user: null },
};

function makeRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  return new NextRequest(url, {
    method: options.method ?? "PATCH",
    headers: options.body ? { "content-type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

const sampleGroup = {
  id: "dg-1",
  name: "Class A",
  visibility: "public" as const,
  userGroupIds: [],
};

const sampleDocument = {
  id: "doc-1",
  title: "Sample Book",
  groupId: "dg-1",
  accessOverride: 0,
  visibility: "public",
};

// ── API-UG-07 & API-UG-08: PATCH /api/document-groups/[id]/visibility ─────

describe("PATCH /api/document-groups/[id]/visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = { params: Promise.resolve({ id: "dg-1" }) };

  it("API-UG-07: admin can set group visibility to public", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentGroupById.mockReturnValue(sampleGroup);
    mocks.setDocumentGroupVisibility.mockReturnValue({ ...sampleGroup, visibility: "public" });

    const req = makeRequest("http://localhost/api/document-groups/dg-1/visibility", {
      body: { visibility: "public", userGroupIds: [] },
    });
    const res = await groupVisibilityPATCH(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.group).toBeDefined();
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(
      "admin-1",
      "document_group_visibility_updated",
      "visibility",
      "dg-1",
      expect.any(String)
    );
  });

  it("API-UG-07: admin can set group visibility to admin_only", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentGroupById.mockReturnValue(sampleGroup);
    mocks.setDocumentGroupVisibility.mockReturnValue({ ...sampleGroup, visibility: "admin_only" });

    const req = makeRequest("http://localhost/api/document-groups/dg-1/visibility", {
      body: { visibility: "admin_only" },
    });
    const res = await groupVisibilityPATCH(req, params);

    expect(res.status).toBe(200);
  });

  it("API-UG-07: admin can set group visibility to user_groups with valid IDs", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentGroupById.mockReturnValue(sampleGroup);
    mocks.getUserGroupById.mockReturnValue({ id: "ug-1", name: "Class A" });
    mocks.setDocumentGroupVisibility.mockReturnValue({
      ...sampleGroup,
      visibility: "user_groups",
      userGroupIds: ["ug-1"],
    });

    const req = makeRequest("http://localhost/api/document-groups/dg-1/visibility", {
      body: { visibility: "user_groups", userGroupIds: ["ug-1"] },
    });
    const res = await groupVisibilityPATCH(req, params);

    expect(res.status).toBe(200);
    expect(mocks.setDocumentGroupVisibility).toHaveBeenCalledWith("dg-1", "user_groups", ["ug-1"]);
  });

  it("API-UG-08: returns 422 when visibility=user_groups with no userGroupIds", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentGroupById.mockReturnValue(sampleGroup);

    const req = makeRequest("http://localhost/api/document-groups/dg-1/visibility", {
      body: { visibility: "user_groups", userGroupIds: [] },
    });
    const res = await groupVisibilityPATCH(req, params);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toMatch(/userGroupIds is required/i);
  });

  it("API-UG-08: returns 422 when visibility=user_groups with missing userGroupIds field", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentGroupById.mockReturnValue(sampleGroup);

    const req = makeRequest("http://localhost/api/document-groups/dg-1/visibility", {
      body: { visibility: "user_groups" },
    });
    const res = await groupVisibilityPATCH(req, params);

    expect(res.status).toBe(422);
  });

  it("returns 404 when group does not exist", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentGroupById.mockReturnValue(null);

    const req = makeRequest("http://localhost/api/document-groups/dg-1/visibility", {
      body: { visibility: "public" },
    });
    const res = await groupVisibilityPATCH(req, params);

    expect(res.status).toBe(404);
  });

  it("returns 404 when a referenced user group does not exist", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentGroupById.mockReturnValue(sampleGroup);
    mocks.getUserGroupById.mockReturnValue(null); // group not found

    const req = makeRequest("http://localhost/api/document-groups/dg-1/visibility", {
      body: { visibility: "user_groups", userGroupIds: ["nonexistent-ug"] },
    });
    const res = await groupVisibilityPATCH(req, params);

    expect(res.status).toBe(404);
  });
});

// ── API-UG-09 through API-UG-12: PATCH /api/documents/[id]/visibility ─────

describe("PATCH /api/documents/[id]/visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = { params: Promise.resolve({ id: "doc-1" }) };

  it("API-UG-09: returns 403 for non-admin users", async () => {
    mocks.checkPermission.mockResolvedValue(USER_AUTH);

    const req = makeRequest("http://localhost/api/documents/doc-1/visibility", {
      body: { accessOverride: true, visibility: "public" },
    });
    const res = await documentVisibilityPATCH(req, params);

    expect(res.status).toBe(403);
  });

  it("API-UG-10: admin can set access override to true with public visibility", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentById.mockReturnValue(sampleDocument);
    mocks.setDocumentVisibility.mockReturnValue({
      ...sampleDocument,
      accessOverride: 1,
      visibility: "public",
    });

    const req = makeRequest("http://localhost/api/documents/doc-1/visibility", {
      body: { accessOverride: true, visibility: "public" },
    });
    const res = await documentVisibilityPATCH(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.document).toBeDefined();
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(
      "admin-1",
      "document_visibility_updated",
      "visibility",
      "doc-1",
      expect.any(String)
    );
  });

  it("API-UG-10: admin can disable access override (inherit from group)", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentById.mockReturnValue(sampleDocument);
    mocks.setDocumentVisibility.mockReturnValue({ ...sampleDocument, accessOverride: 0 });

    const req = makeRequest("http://localhost/api/documents/doc-1/visibility", {
      body: { accessOverride: false, visibility: "public" },
    });
    const res = await documentVisibilityPATCH(req, params);

    expect(res.status).toBe(200);
    expect(mocks.setDocumentVisibility).toHaveBeenCalledWith("doc-1", false, "public", []);
  });

  it("API-UG-11: returns 422 when accessOverride=true, visibility=user_groups, no userGroupIds", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentById.mockReturnValue(sampleDocument);

    const req = makeRequest("http://localhost/api/documents/doc-1/visibility", {
      body: { accessOverride: true, visibility: "user_groups", userGroupIds: [] },
    });
    const res = await documentVisibilityPATCH(req, params);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toMatch(/userGroupIds is required/i);
  });

  it("API-UG-12: returns 404 when a referenced user group does not exist", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentById.mockReturnValue(sampleDocument);
    mocks.getUserGroupById.mockReturnValue(null);

    const req = makeRequest("http://localhost/api/documents/doc-1/visibility", {
      body: { accessOverride: true, visibility: "user_groups", userGroupIds: ["bad-id"] },
    });
    const res = await documentVisibilityPATCH(req, params);

    expect(res.status).toBe(404);
  });

  it("returns 404 when document does not exist", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getDocumentById.mockReturnValue(null);

    const req = makeRequest("http://localhost/api/documents/doc-1/visibility", {
      body: { accessOverride: true, visibility: "public" },
    });
    const res = await documentVisibilityPATCH(req, params);

    expect(res.status).toBe(404);
  });
});

// ── API-UG-13 & API-UG-16: GET /api/documents (list / search filtering) ───

describe("GET /api/documents (visibility filtering)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserStatsMap.mockReturnValue(new Map());
    mocks.listDocumentGroupsWithVisibility.mockReturnValue([
      { id: "dg-1", name: "Public Group", visibility: "public", userGroupIds: [] },
      { id: "dg-2", name: "Admin Group", visibility: "admin_only", userGroupIds: [] },
    ]);
    mocks.getDocumentUserGroupIds.mockReturnValue([]);
  });

  function makeGetRequest(url: string): NextRequest {
    return new NextRequest(url, { method: "GET" });
  }

  it("API-UG-13: guest receives only public documents", async () => {
    mocks.checkPermission.mockResolvedValue({
      authorized: true,
      response: undefined,
      authContext: { user: null, sessionId: null },
    });
    mocks.listDocuments.mockReturnValue([
      { id: "doc-pub", title: "Public Book", groupId: "dg-1", accessOverride: 0, visibility: "public", content: "" },
      { id: "doc-adm", title: "Admin Book", groupId: "dg-2", accessOverride: 0, visibility: "admin_only", content: "" },
    ]);
    // canViewerSeeDocument: public doc → visible, admin doc → not visible
    mocks.canViewerSeeDocument.mockImplementation((_viewer: unknown, doc: { visibility: string }) =>
      doc.visibility === "public"
    );

    const req = makeGetRequest("http://localhost/api/documents");
    const res = await documentsGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    const returned = body.documents as { id: string }[];
    expect(returned.some((d) => d.id === "doc-pub")).toBe(true);
    expect(returned.some((d) => d.id === "doc-adm")).toBe(false);
  });

  it("API-UG-16: search results exclude unauthorized documents", async () => {
    mocks.checkPermission.mockResolvedValue({
      authorized: true,
      response: undefined,
      authContext: { user: null, sessionId: null },
    });
    mocks.searchDocuments.mockReturnValue([
      { id: "doc-priv", title: "Secret Matching Book", groupId: "dg-2", accessOverride: 0, visibility: "admin_only", content: "" },
    ]);
    // Guest cannot see admin_only
    mocks.canViewerSeeDocument.mockReturnValue(false);

    const req = makeGetRequest("http://localhost/api/documents?q=Secret");
    const res = await documentsGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    const returned = body.documents as { id: string }[];
    expect(returned.some((d) => d.id === "doc-priv")).toBe(false);
    expect(returned).toHaveLength(0);
  });
});

// ── API-UG-14: single document access control ──────────────────────────────

describe("GET /api/documents?id= (single document access control)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserStatsMap.mockReturnValue(new Map());
    mocks.listDocumentGroupsWithVisibility.mockReturnValue([
      { id: "dg-1", name: "Admin Only Group", visibility: "admin_only", userGroupIds: [] },
    ]);
    mocks.getDocumentUserGroupIds.mockReturnValue([]);
  });

  function makeGetRequest(url: string): NextRequest {
    return new NextRequest(url, { method: "GET" });
  }

  it("API-UG-14: returns 404 when guest tries to access admin_only document", async () => {
    mocks.checkPermission.mockResolvedValue({
      authorized: true,
      response: undefined,
      authContext: { user: null, sessionId: null },
    });
    mocks.getDocumentById.mockReturnValue({
      id: "doc-1",
      title: "Admin Book",
      groupId: "dg-1",
      accessOverride: 0,
      visibility: "admin_only",
      content: "secret content",
    });
    mocks.getUserGroupIds.mockReturnValue([]);
    mocks.canViewerSeeDocument.mockReturnValue(false);

    const req = makeGetRequest("http://localhost/api/documents?id=doc-1");
    const res = await documentsGET(req);

    expect(res.status).toBe(404);
  });

  it("API-UG-14: returns 404 when regular user accesses user_groups document they are not in", async () => {
    mocks.checkPermission.mockResolvedValue({
      authorized: true,
      response: undefined,
      authContext: { user: { id: "user-1", role: "user", status: "active" }, sessionId: "session-1" },
    });
    mocks.getDocumentById.mockReturnValue({
      id: "doc-1",
      title: "Restricted Book",
      groupId: "dg-1",
      accessOverride: 1,
      visibility: "user_groups",
      content: "restricted content",
    });
    mocks.getUserGroupIds.mockReturnValue([]);
    mocks.canViewerSeeDocument.mockReturnValue(false);

    const req = makeGetRequest("http://localhost/api/documents?id=doc-1");
    const res = await documentsGET(req);

    expect(res.status).toBe(404);
  });
});

// ── API-UG-15: DELETE /api/document-groups (group with books) ─────────────

describe("DELETE /api/document-groups (API-UG-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("API-UG-15: admin cannot delete a group that still contains books", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.deleteDocumentGroup.mockReturnValue({ success: false, bookCount: 3 });

    const req = new NextRequest("http://localhost/api/document-groups?id=dg-1", {
      method: "DELETE",
    });
    const res = await documentGroupDELETE(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/still contains/i);
  });

  it("can delete an empty group", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.deleteDocumentGroup.mockReturnValue({ success: true });

    const req = new NextRequest("http://localhost/api/document-groups?id=dg-1", {
      method: "DELETE",
    });
    const res = await documentGroupDELETE(req);

    expect(res.status).toBe(200);
  });
});
