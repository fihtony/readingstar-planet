import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  createDocument: vi.fn(),
  getDocumentById: vi.fn(),
  listDocuments: vi.fn(),
  searchDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
  incrementDocumentReadCount: vi.fn(),
  getDocumentUserGroupIds: vi.fn(),
  moveDocumentWithVisibilityHandling: vi.fn(),
  listDocumentGroupsWithVisibility: vi.fn(),
  getUserGroupIds: vi.fn(),
  canViewerSeeDocument: vi.fn(),
  canViewerSeeGroup: vi.fn(),
  getUserStatsMap: vi.fn(),
  logAdminAudit: vi.fn(),
  logUserActivity: vi.fn(),
  getAuthContext: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/repositories/document-repository", () => ({
  createDocument: mocks.createDocument,
  getDocumentById: mocks.getDocumentById,
  listDocuments: mocks.listDocuments,
  searchDocuments: mocks.searchDocuments,
  deleteDocument: mocks.deleteDocument,
  updateDocument: mocks.updateDocument,
  incrementDocumentReadCount: mocks.incrementDocumentReadCount,
  getDocumentUserGroupIds: mocks.getDocumentUserGroupIds,
  moveDocumentWithVisibilityHandling: mocks.moveDocumentWithVisibilityHandling,
}));

vi.mock("@/lib/repositories/document-group-repository", () => ({
  listDocumentGroupsWithVisibility: mocks.listDocumentGroupsWithVisibility,
}));

vi.mock("@/lib/repositories/user-group-repository", () => ({
  getUserGroupIds: mocks.getUserGroupIds,
}));

vi.mock("@/lib/visibility", () => ({
  canViewerSeeDocument: mocks.canViewerSeeDocument,
  canViewerSeeGroup: mocks.canViewerSeeGroup,
}));

vi.mock("@/lib/repositories/reading-stats-repository", () => ({
  recordUserRead: vi.fn(),
  getUserStatsMap: mocks.getUserStatsMap,
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
  sanitizeTextContent: vi.fn((value: string) => value),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import { GET, PATCH } from "@/app/api/documents/route";

function makeRequest(url: string, init: { method?: string; body?: unknown } = {}) {
  return new NextRequest(url, {
    method: init.method ?? "GET",
    headers: init.body ? { "content-type": "application/json" } : {},
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

const baseDocument = {
  id: "doc-1",
  title: "Secret Plan",
  content: "Keep reading.",
  originalFilename: "secret.txt",
  fileType: "txt",
  fileSize: 120,
  uploadedBy: "admin-1",
  groupId: "group-1",
  groupPosition: 0,
  icon: null,
  accessOverride: true,
  visibility: "admin_only",
  createdAt: "2026-04-03T00:00:00.000Z",
  updatedAt: "2026-04-03T00:00:00.000Z",
  readCount: 1,
};

describe("documents API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserStatsMap.mockReturnValue(new Map());
    mocks.listDocuments.mockReturnValue([]);
    mocks.searchDocuments.mockReturnValue([]);
    mocks.listDocumentGroupsWithVisibility.mockReturnValue([
      {
        id: "group-1",
        userId: "admin-1",
        name: "Group One",
        position: 0,
        visibility: "public",
        userGroupIds: [],
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
    ]);
    mocks.getDocumentUserGroupIds.mockReturnValue(["ug-1"]);
  });

  it("strips internal visibility fields from direct document responses for non-admin viewers", async () => {
    mocks.checkPermission.mockResolvedValue({
      authContext: { user: { id: "user-1", role: "user" } },
    });
    mocks.getUserGroupIds.mockReturnValue(["ug-1"]);
    mocks.getDocumentById.mockReturnValue(baseDocument);
    mocks.canViewerSeeDocument.mockReturnValue(true);

    const response = await GET(makeRequest("http://localhost/api/documents?id=doc-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.document.id).toBe("doc-1");
    expect(body.document.accessOverride).toBeUndefined();
    expect(body.document.visibility).toBeUndefined();
    expect(body.document.userGroupIds).toBeUndefined();
  });

  it("returns 404 when a non-admin requests a document they cannot access", async () => {
    mocks.checkPermission.mockResolvedValue({
      authContext: { user: { id: "user-2", role: "user" } },
    });
    mocks.getUserGroupIds.mockReturnValue([]);
    mocks.getDocumentById.mockReturnValue(baseDocument);
    mocks.canViewerSeeDocument.mockReturnValue(false);

    const response = await GET(makeRequest("http://localhost/api/documents?id=doc-1"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Document not found");
  });

  it("keeps visibility fields for admin direct document responses", async () => {
    mocks.checkPermission.mockResolvedValue({
      authContext: { user: { id: "admin-1", role: "admin" } },
    });
    mocks.getDocumentById.mockReturnValue(baseDocument);

    const response = await GET(makeRequest("http://localhost/api/documents?id=doc-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.document.accessOverride).toBe(true);
    expect(body.document.visibility).toBe("admin_only");
    expect(body.document.userGroupIds).toEqual(["ug-1"]);
  });

  it("returns a confirmation payload when move-document changes effective visibility", async () => {
    mocks.checkPermission.mockResolvedValue({
      authorized: true,
      response: undefined,
      authContext: { user: { id: "admin-1", role: "admin" } },
    });
    mocks.moveDocumentWithVisibilityHandling.mockReturnValue({
      status: "confirmation_required",
      confirmation: {
        documentTitle: "Secret Plan",
        sourceGroupName: "Public Shelf",
        targetGroupName: "Admin Shelf",
        currentVisibility: { visibility: "public", userGroupIds: [] },
        targetVisibility: { visibility: "admin_only", userGroupIds: [] },
      },
    });

    const response = await PATCH(makeRequest("http://localhost/api/documents", {
      method: "PATCH",
      body: {
        action: "move-document",
        documentId: "doc-1",
        groupId: "group-2",
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/confirmation/i);
    expect(body.confirmation.documentTitle).toBe("Secret Plan");
    expect(mocks.moveDocumentWithVisibilityHandling).toHaveBeenCalledWith("doc-1", "group-2", undefined);
  });
});