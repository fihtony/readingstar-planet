import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LibraryPage from "@/app/library/page";
import type { Document, DocumentGroup } from "@/types";

const pushMock = vi.fn();
const csrfFetchMock = vi.fn();
const authState = {
  isAdmin: true,
  isAuthenticated: true,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
  useCsrfFetch: () => csrfFetchMock,
}));

vi.mock("@/components/upload/DocumentUpload", () => ({
  DocumentUpload: () => <div data-testid="document-upload" />,
}));

vi.mock("@/components/mascot/MascotGuide", () => ({
  MascotGuide: ({ message }: { message: string }) => <div>{message}</div>,
}));

const mockGroup: DocumentGroup = {
  id: "group-1",
  userId: "user-1",
  name: "Science",
  position: 0,
  visibility: "public",
  userGroupIds: [],
  createdAt: "2026-03-31T00:00:00.000Z",
  updatedAt: "2026-03-31T00:00:00.000Z",
};

const mockDocument: Document = {
  id: "doc-1",
  title: "Moon Book",
  content: "The moon is bright tonight.",
  originalFilename: "moon-book.txt",
  fileType: "txt",
  fileSize: 120,
  uploadedBy: "user-1",
  groupId: "group-1",
  groupPosition: 0,
  icon: null,
  accessOverride: true,
  visibility: "admin_only",
  userGroupIds: [],
  createdAt: "2026-03-31T00:00:00.000Z",
  updatedAt: "2026-03-31T00:00:00.000Z",
  readCount: 3,
};

describe("LibraryPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    csrfFetchMock.mockReset();
    authState.isAdmin = true;
    authState.isAuthenticated = true;
    csrfFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/admin/user-groups")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ groups: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            documents: [mockDocument],
            groups: [mockGroup],
            userStats: {},
          }),
        });
      }) as unknown as typeof fetch
    );
  });

  it("shows a clear button inside the search input when text is entered", async () => {
    render(<LibraryPage />);

    const searchInput = await screen.findByRole("textbox", {
      name: "Search books...",
    });

    expect(
      screen.queryByRole("button", { name: "Clear search" })
    ).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "moon" } });

    const clearButton = screen.getByRole("button", { name: "Clear search" });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Clear search" })
    ).not.toBeInTheDocument();
  });

  it("keeps group rename input outside draggable containers", async () => {
    render(<LibraryPage />);

    const editButton = await screen.findByRole("button", {
      name: "Rename group",
    });
    fireEvent.click(editButton);

    const renameInput = screen.getByDisplayValue("Science");
    expect(renameInput.closest('[draggable="true"]')).toBeNull();

    const dragHandle = screen.getByRole("button", { name: "Drag group" });
    expect(dragHandle).toHaveAttribute("draggable", "true");
  });

  it("shows visibility badges for admins", async () => {
    render(<LibraryPage />);

    expect(await screen.findByText("PUBLIC")).toBeInTheDocument();
    expect(await screen.findByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit bookshelf access" })).toBeInTheDocument();
  });

  it("shows the no-access empty state for non-admin viewers", async () => {
    authState.isAdmin = false;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/admin/user-groups")) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ groups: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            documents: [],
            groups: [],
            userStats: {},
          }),
        });
      }) as unknown as typeof fetch
    );

    render(<LibraryPage />);

    expect(
      await screen.findByText("No books are available to read right now. Please contact your teacher.")
    ).toBeInTheDocument();
  });
});