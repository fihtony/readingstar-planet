import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  listUserGroups: vi.fn(),
  getUserGroupById: vi.fn(),
  createUserGroup: vi.fn(),
  updateUserGroup: vi.fn(),
  deleteUserGroup: vi.fn(),
  listGroupMembers: vi.fn(),
  addGroupMembers: vi.fn(),
  removeGroupMember: vi.fn(),
  logAdminAudit: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
}));

vi.mock("@/lib/repositories/user-group-repository", () => ({
  listUserGroups: mocks.listUserGroups,
  getUserGroupById: mocks.getUserGroupById,
  createUserGroup: mocks.createUserGroup,
  updateUserGroup: mocks.updateUserGroup,
  deleteUserGroup: mocks.deleteUserGroup,
  listGroupMembers: mocks.listGroupMembers,
  addGroupMembers: mocks.addGroupMembers,
  removeGroupMember: mocks.removeGroupMember,
}));

vi.mock("@/lib/auth", () => ({
  logAdminAudit: mocks.logAdminAudit,
}));

import {
  GET as collectionGET,
  POST as collectionPOST,
} from "@/app/api/admin/user-groups/route";
import {
  PATCH as itemPATCH,
  DELETE as itemDELETE,
} from "@/app/api/admin/user-groups/[id]/route";
import {
  GET as membersGET,
  POST as membersPOST,
} from "@/app/api/admin/user-groups/[id]/members/route";
import { DELETE as memberDELETE } from "@/app/api/admin/user-groups/[id]/members/[userId]/route";

// ── Helpers ────────────────────────────────────────────────────────────────

const ADMIN_AUTH = {
  authorized: true,
  response: undefined,
  authContext: { user: { id: "admin-1", role: "admin" } },
};

const UNAUTHORIZED = {
  authorized: false,
  response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  authContext: { user: null },
};

function makeRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  return new NextRequest(url, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

const sampleGroup = {
  id: "ug-1",
  name: "Readers",
  description: "Regular readers",
  memberCount: 2,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// ── GET /api/admin/user-groups ─────────────────────────────────────────────

describe("GET /api/admin/user-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin requests", async () => {
    mocks.checkPermission.mockResolvedValue(UNAUTHORIZED);
    const req = makeRequest("http://localhost/api/admin/user-groups");
    const res = await collectionGET(req);
    expect(res.status).toBe(401);
  });

  it("returns list of groups for admin", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.listUserGroups.mockReturnValue([sampleGroup]);

    const req = makeRequest("http://localhost/api/admin/user-groups");
    const res = await collectionGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].id).toBe("ug-1");
  });

  it("returns empty array when no groups exist", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.listUserGroups.mockReturnValue([]);

    const req = makeRequest("http://localhost/api/admin/user-groups");
    const res = await collectionGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.groups).toEqual([]);
  });
});

// ── POST /api/admin/user-groups ────────────────────────────────────────────

describe("POST /api/admin/user-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    mocks.checkPermission.mockResolvedValue(UNAUTHORIZED);
    const req = makeRequest("http://localhost/api/admin/user-groups", {
      method: "POST",
      body: { name: "New Group" },
    });
    const res = await collectionPOST(req);
    expect(res.status).toBe(401);
  });

  it("creates a group and returns 201", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.createUserGroup.mockReturnValue(sampleGroup);

    const req = makeRequest("http://localhost/api/admin/user-groups", {
      method: "POST",
      body: { name: "Readers", description: "Regular readers" },
    });
    const res = await collectionPOST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.group.id).toBe("ug-1");
    expect(mocks.createUserGroup).toHaveBeenCalledWith({
      name: "Readers",
      description: "Regular readers",
    });
    expect(mocks.logAdminAudit).toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);

    const req = makeRequest("http://localhost/api/admin/user-groups", {
      method: "POST",
      body: { description: "no name" },
    });
    const res = await collectionPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/name/i);
  });

  it("returns 400 when name exceeds 50 characters", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);

    const req = makeRequest("http://localhost/api/admin/user-groups", {
      method: "POST",
      body: { name: "A".repeat(51) },
    });
    const res = await collectionPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/50/);
  });

  it("returns 400 when description exceeds 200 characters", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);

    const req = makeRequest("http://localhost/api/admin/user-groups", {
      method: "POST",
      body: { name: "Valid", description: "D".repeat(201) },
    });
    const res = await collectionPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/200/);
  });

  it("returns 409 on duplicate name", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.createUserGroup.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed");
    });

    const req = makeRequest("http://localhost/api/admin/user-groups", {
      method: "POST",
      body: { name: "Readers" },
    });
    const res = await collectionPOST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });
});

// ── PATCH /api/admin/user-groups/[id] ─────────────────────────────────────

describe("PATCH /api/admin/user-groups/[id]", () => {
  const params = { params: Promise.resolve({ id: "ug-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    mocks.checkPermission.mockResolvedValue(UNAUTHORIZED);
    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "PATCH",
      body: { name: "New Name" },
    });
    const res = await itemPATCH(req, params);
    expect(res.status).toBe(401);
  });

  it("updates group name", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.updateUserGroup.mockReturnValue({ ...sampleGroup, name: "New Name" });

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "PATCH",
      body: { name: "New Name" },
    });
    const res = await itemPATCH(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.group.name).toBe("New Name");
    expect(mocks.logAdminAudit).toHaveBeenCalled();
  });

  it("returns 404 when group not found", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.updateUserGroup.mockReturnValue(null);

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "PATCH",
      body: { name: "X" },
    });
    const res = await itemPATCH(req, params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 409 on duplicate name during update", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.updateUserGroup.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed");
    });

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "PATCH",
      body: { name: "Taken" },
    });
    const res = await itemPATCH(req, params);
    expect(res.status).toBe(409);
  });
});

// ── DELETE /api/admin/user-groups/[id] ────────────────────────────────────

describe("DELETE /api/admin/user-groups/[id]", () => {
  const params = { params: Promise.resolve({ id: "ug-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    mocks.checkPermission.mockResolvedValue(UNAUTHORIZED);
    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "DELETE",
    });
    const res = await itemDELETE(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when group not found", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(null);

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "DELETE",
    });
    const res = await itemDELETE(req, params);
    expect(res.status).toBe(404);
  });

  it("deletes empty group and returns success", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.deleteUserGroup.mockReturnValue({ success: true });

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "DELETE",
    });
    const res = await itemDELETE(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.logAdminAudit).toHaveBeenCalled();
  });

  it("returns 409 when group has members and force=false", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.deleteUserGroup.mockReturnValue({ success: false, memberCount: 3 });

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1", {
      method: "DELETE",
    });
    const res = await itemDELETE(req, params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.memberCount).toBe(3);
    expect(body.error).toMatch(/members/i);
  });

  it("force-deletes group with members when force=true", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.deleteUserGroup.mockReturnValue({ success: true });

    const req = makeRequest(
      "http://localhost/api/admin/user-groups/ug-1?force=true",
      { method: "DELETE" }
    );
    const res = await itemDELETE(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.deleteUserGroup).toHaveBeenCalledWith("ug-1", true);
  });
});

// ── GET /api/admin/user-groups/[id]/members ────────────────────────────────

describe("GET /api/admin/user-groups/[id]/members", () => {
  const params = { params: Promise.resolve({ id: "ug-1" }) };
  const sampleMember = {
    id: "user-1",
    email: "alice@example.com",
    name: "Alice",
    nickname: "alice",
    role: "user",
    status: "active",
    assignedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    mocks.checkPermission.mockResolvedValue(UNAUTHORIZED);
    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1/members");
    const res = await membersGET(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when group not found", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(null);

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1/members");
    const res = await membersGET(req, params);
    expect(res.status).toBe(404);
  });

  it("returns members list", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.listGroupMembers.mockReturnValue([sampleMember]);

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1/members");
    const res = await membersGET(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toHaveLength(1);
    expect(body.members[0].id).toBe("user-1");
  });

  it("passes query filters to the repository", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.listGroupMembers.mockReturnValue([]);

    const req = makeRequest(
      "http://localhost/api/admin/user-groups/ug-1/members?query=alice&role=user&status=active"
    );
    const res = await membersGET(req, params);

    expect(res.status).toBe(200);
    expect(mocks.listGroupMembers).toHaveBeenCalledWith("ug-1", {
      query: "alice",
      role: "user",
      status: "active",
      memberGroupId: undefined,
    });
  });
});

// ── POST /api/admin/user-groups/[id]/members ───────────────────────────────

describe("POST /api/admin/user-groups/[id]/members", () => {
  const params = { params: Promise.resolve({ id: "ug-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    mocks.checkPermission.mockResolvedValue(UNAUTHORIZED);
    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1/members", {
      method: "POST",
      body: { userIds: ["user-1"] },
    });
    const res = await membersPOST(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when group not found", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(null);

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1/members", {
      method: "POST",
      body: { userIds: ["user-1"] },
    });
    const res = await membersPOST(req, params);
    expect(res.status).toBe(404);
  });

  it("adds members and returns success", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.addGroupMembers.mockReturnValue(undefined);

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1/members", {
      method: "POST",
      body: { userIds: ["user-1", "user-2"] },
    });
    const res = await membersPOST(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.addGroupMembers).toHaveBeenCalledWith("ug-1", ["user-1", "user-2"]);
    expect(mocks.logAdminAudit).toHaveBeenCalled();
  });

  it("returns 400 when userIds is missing or empty", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);

    const req = makeRequest("http://localhost/api/admin/user-groups/ug-1/members", {
      method: "POST",
      body: { userIds: [] },
    });
    const res = await membersPOST(req, params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/userIds/i);
  });
});

// ── DELETE /api/admin/user-groups/[id]/members/[userId] ───────────────────

describe("DELETE /api/admin/user-groups/[id]/members/[userId]", () => {
  const params = { params: Promise.resolve({ id: "ug-1", userId: "user-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    mocks.checkPermission.mockResolvedValue(UNAUTHORIZED);
    const req = makeRequest(
      "http://localhost/api/admin/user-groups/ug-1/members/user-1",
      { method: "DELETE" }
    );
    const res = await memberDELETE(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when group not found", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(null);

    const req = makeRequest(
      "http://localhost/api/admin/user-groups/ug-1/members/user-1",
      { method: "DELETE" }
    );
    const res = await memberDELETE(req, params);
    expect(res.status).toBe(404);
  });

  it("removes member and returns success", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.removeGroupMember.mockReturnValue(true);

    const req = makeRequest(
      "http://localhost/api/admin/user-groups/ug-1/members/user-1",
      { method: "DELETE" }
    );
    const res = await memberDELETE(req, params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.removeGroupMember).toHaveBeenCalledWith("ug-1", "user-1");
    expect(mocks.logAdminAudit).toHaveBeenCalled();
  });

  it("returns 404 when user was not a member", async () => {
    mocks.checkPermission.mockResolvedValue(ADMIN_AUTH);
    mocks.getUserGroupById.mockReturnValue(sampleGroup);
    mocks.removeGroupMember.mockReturnValue(false);

    const req = makeRequest(
      "http://localhost/api/admin/user-groups/ug-1/members/user-1",
      { method: "DELETE" }
    );
    const res = await memberDELETE(req, params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });
});
