import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReadPage from "@/app/read/[id]/page";
import type { Document } from "@/types";

const {
  notFoundMock,
  getAuthContextMock,
  getDocumentByIdMock,
  getDocumentUserGroupIdsMock,
  listDocumentGroupsWithVisibilityMock,
  getUserGroupIdsMock,
  canViewerSeeDocumentMock,
} = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  getAuthContextMock: vi.fn(),
  getDocumentByIdMock: vi.fn(),
  getDocumentUserGroupIdsMock: vi.fn(),
  listDocumentGroupsWithVisibilityMock: vi.fn(),
  getUserGroupIdsMock: vi.fn(),
  canViewerSeeDocumentMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/auth", () => ({
  getReadOnlyAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/repositories/document-repository", () => ({
  getDocumentById: getDocumentByIdMock,
  getDocumentUserGroupIds: getDocumentUserGroupIdsMock,
}));

vi.mock("@/lib/repositories/document-group-repository", () => ({
  listDocumentGroupsWithVisibility: listDocumentGroupsWithVisibilityMock,
}));

vi.mock("@/lib/repositories/user-group-repository", () => ({
  getUserGroupIds: getUserGroupIdsMock,
}));

vi.mock("@/lib/visibility", () => ({
  canViewerSeeDocument: canViewerSeeDocumentMock,
}));

vi.mock("@/app/read/[id]/ReadPageClient", () => ({
  default: ({
    documentId,
    initialDocument,
  }: {
    documentId: string;
    initialDocument: Document;
  }) => (
    <div data-testid="read-page-client">
      {documentId}:{initialDocument.title}
    </div>
  ),
}));

const mockDocument: Document = {
  id: "doc-1",
  title: "Moon Book",
  content: "The moon is bright tonight.",
  originalFilename: "moon-book.txt",
  fileType: "txt",
  fileSize: 120,
  uploadedBy: "admin-1",
  groupId: null,
  groupPosition: 0,
  icon: null,
  accessOverride: true,
  visibility: "admin_only",
  userGroupIds: [],
  createdAt: "2026-03-31T00:00:00.000Z",
  updatedAt: "2026-03-31T00:00:00.000Z",
  readCount: 0,
};

describe("ReadPage", () => {
  beforeEach(() => {
    notFoundMock.mockClear();
    getAuthContextMock.mockReset();
    getDocumentByIdMock.mockReset();
    getDocumentUserGroupIdsMock.mockReset();
    listDocumentGroupsWithVisibilityMock.mockReset();
    getUserGroupIdsMock.mockReset();
    canViewerSeeDocumentMock.mockReset();

    getAuthContextMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    getDocumentByIdMock.mockReturnValue(mockDocument);
    getDocumentUserGroupIdsMock.mockReturnValue([]);
    listDocumentGroupsWithVisibilityMock.mockReturnValue([]);
    getUserGroupIdsMock.mockReturnValue([]);
    canViewerSeeDocumentMock.mockReturnValue(true);
  });

  it("renders the client page for admins", async () => {
    render(await ReadPage({ params: Promise.resolve({ id: "doc-1" }) }));

    expect(screen.getByTestId("read-page-client")).toHaveTextContent("doc-1:Moon Book");
    expect(canViewerSeeDocumentMock).not.toHaveBeenCalled();
  });

  it("returns notFound when the document does not exist", async () => {
    getDocumentByIdMock.mockReturnValue(null);

    await expect(
      ReadPage({ params: Promise.resolve({ id: "missing-doc" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("returns notFound when a non-admin cannot access the document", async () => {
    getAuthContextMock.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    getUserGroupIdsMock.mockReturnValue(["group-a"]);
    canViewerSeeDocumentMock.mockReturnValue(false);

    await expect(
      ReadPage({ params: Promise.resolve({ id: "doc-1" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(canViewerSeeDocumentMock).toHaveBeenCalledWith(
      { role: "user", groupIds: ["group-a"] },
      expect.objectContaining({
        accessOverride: true,
        visibility: "admin_only",
      })
    );
  });
});