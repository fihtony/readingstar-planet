import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";

let testDb: InstanceType<typeof Database>;

vi.mock("@/lib/db", () => ({
  getDatabase: () => testDb,
}));

import { initializeSchema } from "@/lib/schema";
import {
  listUserGroups,
  getUserGroupById,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  listGroupMembers,
  addGroupMembers,
  removeGroupMember,
  getUserGroupIds,
  getUserGroupsForUser,
  setUserGroups,
} from "@/lib/repositories/user-group-repository";

// Helper to insert a user into the test DB
function insertUser(
  id: string,
  email: string,
  role: "admin" | "user" = "user",
  status: "active" | "inactive" = "active"
) {
  testDb
    .prepare(
      `INSERT INTO users (id, email, nickname, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    )
    .run(id, email, email.split("@")[0], role, status);
}

describe("user-group-repository", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    testDb.pragma("journal_mode = WAL");
    testDb.pragma("foreign_keys = ON");
    initializeSchema(testDb);

    insertUser("user-1", "alice@example.com", "user");
    insertUser("user-2", "bob@example.com", "user");
    insertUser("user-3", "carol@example.com", "admin");
  });

  afterEach(() => {
    testDb.close();
  });

  // ── createUserGroup / listUserGroups ─────────────────────────────────────

  it("creates a group and retrieves it by id", () => {
    const group = createUserGroup({ name: "Readers", description: "A reading group" });

    expect(group.id).toBeDefined();
    expect(group.name).toBe("Readers");
    expect(group.description).toBe("A reading group");
    expect(group.memberCount).toBe(0);

    const fetched = getUserGroupById(group.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(group.id);
    expect(fetched!.name).toBe("Readers");
  });

  it("trims whitespace from group name and description", () => {
    const group = createUserGroup({ name: "  Trimmed  ", description: "  Desc  " });
    expect(group.name).toBe("Trimmed");
    expect(group.description).toBe("Desc");
  });

  it("defaults description to empty string when not provided", () => {
    const group = createUserGroup({ name: "NoDesc" });
    expect(group.description).toBe("");
  });

  it("stores timestamps on creation", () => {
    const group = createUserGroup({ name: "TimeGroup" });
    expect(group.createdAt).toBeDefined();
    expect(group.updatedAt).toBeDefined();
    expect(() => new Date(group.createdAt)).not.toThrow();
  });

  it("rejects duplicate group names", () => {
    createUserGroup({ name: "DupGroup" });
    expect(() => createUserGroup({ name: "DupGroup" })).toThrow();
  });

  it("listUserGroups returns all groups with correct member counts", () => {
    const g1 = createUserGroup({ name: "Alpha" });
    const g2 = createUserGroup({ name: "Beta" });
    addGroupMembers(g1.id, ["user-1", "user-2"]);
    addGroupMembers(g2.id, ["user-1"]);

    const list = listUserGroups();
    expect(list).toHaveLength(2);

    const alpha = list.find((g) => g.id === g1.id)!;
    const beta = list.find((g) => g.id === g2.id)!;
    expect(alpha.memberCount).toBe(2);
    expect(beta.memberCount).toBe(1);
  });

  it("listUserGroups orders groups alphabetically by name", () => {
    createUserGroup({ name: "Zebra" });
    createUserGroup({ name: "Apple" });
    createUserGroup({ name: "Mango" });

    const list = listUserGroups();
    expect(list.map((g) => g.name)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("returns null for a non-existent group id", () => {
    expect(getUserGroupById("no-such-id")).toBeNull();
  });

  // ── updateUserGroup ───────────────────────────────────────────────────────

  it("updates group name", () => {
    const group = createUserGroup({ name: "Original" });
    const updated = updateUserGroup(group.id, { name: "Updated" });
    expect(updated!.name).toBe("Updated");
  });

  it("updates group description only", () => {
    const group = createUserGroup({ name: "MyGroup", description: "Old" });
    const updated = updateUserGroup(group.id, { description: "New Desc" });
    expect(updated!.name).toBe("MyGroup");
    expect(updated!.description).toBe("New Desc");
  });

  it("returns null when updating a non-existent group", () => {
    const result = updateUserGroup("no-such-id", { name: "X" });
    expect(result).toBeNull();
  });

  // ── deleteUserGroup ───────────────────────────────────────────────────────

  it("deletes a group with no members successfully", () => {
    const group = createUserGroup({ name: "Empty" });
    const result = deleteUserGroup(group.id);
    expect(result).toEqual({ success: true });
    expect(getUserGroupById(group.id)).toBeNull();
  });

  it("refuses to delete a group with members without force flag", () => {
    const group = createUserGroup({ name: "HasMembers" });
    addGroupMembers(group.id, ["user-1", "user-2"]);

    const result = deleteUserGroup(group.id);
    expect(result.success).toBe(false);
    expect(result.memberCount).toBe(2);

    // Group still exists
    expect(getUserGroupById(group.id)).not.toBeNull();
  });

  it("force-deletes a group with members", () => {
    const group = createUserGroup({ name: "ForceDelete" });
    addGroupMembers(group.id, ["user-1"]);

    const result = deleteUserGroup(group.id, true);
    expect(result).toEqual({ success: true });
    expect(getUserGroupById(group.id)).toBeNull();
    expect(getUserGroupIds("user-1")).not.toContain(group.id);
  });

  it("cascades visibility downgrade when deleted group was the sole group for a document group", () => {
    const group = createUserGroup({ name: "Sole" });

    // Create a document group with user_groups visibility pointing at this group
    const docGroupId = "dg-cascade";
    testDb
      .prepare(
        `INSERT INTO document_groups (id, user_id, name, position, visibility, created_at, updated_at)
         VALUES (?, 'user-1', 'Cascade DG', 0, 'user_groups', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .run(docGroupId);
    testDb
      .prepare(
        `INSERT INTO document_group_visibility (document_group_id, user_group_id) VALUES (?, ?)`
      )
      .run(docGroupId, group.id);

    deleteUserGroup(group.id, true);

    const row = testDb
      .prepare("SELECT visibility FROM document_groups WHERE id = ?")
      .get(docGroupId) as { visibility: string };
    expect(row.visibility).toBe("admin_only");
  });

  it("does NOT downgrade document group visibility when another group remains", () => {
    const g1 = createUserGroup({ name: "Group1" });
    const g2 = createUserGroup({ name: "Group2" });

    const docGroupId = "dg-multi";
    testDb
      .prepare(
        `INSERT INTO document_groups (id, user_id, name, position, visibility, created_at, updated_at)
         VALUES (?, 'user-1', 'Multi DG', 0, 'user_groups', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .run(docGroupId);
    testDb
      .prepare(`INSERT INTO document_group_visibility (document_group_id, user_group_id) VALUES (?, ?)`)
      .run(docGroupId, g1.id);
    testDb
      .prepare(`INSERT INTO document_group_visibility (document_group_id, user_group_id) VALUES (?, ?)`)
      .run(docGroupId, g2.id);

    deleteUserGroup(g1.id, true);

    const row = testDb
      .prepare("SELECT visibility FROM document_groups WHERE id = ?")
      .get(docGroupId) as { visibility: string };
    // Still user_groups because g2 remains
    expect(row.visibility).toBe("user_groups");
  });

  // ── Member management ─────────────────────────────────────────────────────

  it("addGroupMembers adds users to a group", () => {
    const group = createUserGroup({ name: "Members" });
    addGroupMembers(group.id, ["user-1", "user-2"]);

    const ids = getUserGroupIds("user-1");
    expect(ids).toContain(group.id);
  });

  it("addGroupMembers is idempotent (INSERT OR IGNORE)", () => {
    const group = createUserGroup({ name: "Dedup" });
    addGroupMembers(group.id, ["user-1"]);
    addGroupMembers(group.id, ["user-1"]); // duplicate

    const fetched = getUserGroupById(group.id);
    expect(fetched!.memberCount).toBe(1);
  });

  it("removeGroupMember removes a single member and returns true", () => {
    const group = createUserGroup({ name: "ToRemove" });
    addGroupMembers(group.id, ["user-1", "user-2"]);

    const removed = removeGroupMember(group.id, "user-1");
    expect(removed).toBe(true);

    expect(getUserGroupIds("user-1")).not.toContain(group.id);
    expect(getUserGroupIds("user-2")).toContain(group.id);
  });

  it("removeGroupMember returns false when member did not exist", () => {
    const group = createUserGroup({ name: "NoOp" });
    const result = removeGroupMember(group.id, "user-1");
    expect(result).toBe(false);
  });

  // ── listGroupMembers ──────────────────────────────────────────────────────

  it("listGroupMembers returns members of the group", () => {
    const group = createUserGroup({ name: "ListTest" });
    addGroupMembers(group.id, ["user-1", "user-2"]);

    const members = listGroupMembers(group.id);
    expect(members).toHaveLength(2);
    const emails = members.map((m) => m.email).sort();
    expect(emails).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("listGroupMembers filters by query string", () => {
    const group = createUserGroup({ name: "FilterQuery" });
    addGroupMembers(group.id, ["user-1", "user-2", "user-3"]);

    const results = listGroupMembers(group.id, { query: "carol" });
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe("carol@example.com");
  });

  it("listGroupMembers filters by role", () => {
    const group = createUserGroup({ name: "FilterRole" });
    addGroupMembers(group.id, ["user-1", "user-3"]); // user-1=user, user-3=admin

    const admins = listGroupMembers(group.id, { role: "admin" });
    expect(admins).toHaveLength(1);
    expect(admins[0].id).toBe("user-3");
  });

  it("listGroupMembers filters by status", () => {
    insertUser("user-4", "inactive@example.com", "user", "inactive");
    const group = createUserGroup({ name: "FilterStatus" });
    addGroupMembers(group.id, ["user-1", "user-4"]);

    const active = listGroupMembers(group.id, { status: "active" });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("user-1");
  });

  it("listGroupMembers orders members by email", () => {
    const group = createUserGroup({ name: "OrderTest" });
    addGroupMembers(group.id, ["user-2", "user-1", "user-3"]);

    const members = listGroupMembers(group.id);
    const emails = members.map((m) => m.email);
    expect(emails).toEqual([...emails].sort());
  });

  // ── getUserGroupIds / getUserGroupsForUser ────────────────────────────────

  it("getUserGroupIds returns all group ids for a user", () => {
    const g1 = createUserGroup({ name: "G1" });
    const g2 = createUserGroup({ name: "G2" });
    addGroupMembers(g1.id, ["user-1"]);
    addGroupMembers(g2.id, ["user-1"]);

    const ids = getUserGroupIds("user-1");
    expect(ids).toHaveLength(2);
    expect(ids).toContain(g1.id);
    expect(ids).toContain(g2.id);
  });

  it("getUserGroupIds returns empty array when user has no groups", () => {
    expect(getUserGroupIds("user-1")).toEqual([]);
  });

  it("getUserGroupsForUser returns full group objects for a user", () => {
    const g1 = createUserGroup({ name: "ForUser" });
    addGroupMembers(g1.id, ["user-1"]);

    const groups = getUserGroupsForUser("user-1");
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(g1.id);
    expect(groups[0].name).toBe("ForUser");
  });

  // ── setUserGroups ─────────────────────────────────────────────────────────

  it("setUserGroups replaces all group memberships for a user", () => {
    const g1 = createUserGroup({ name: "Set1" });
    const g2 = createUserGroup({ name: "Set2" });
    const g3 = createUserGroup({ name: "Set3" });

    setUserGroups("user-1", [g1.id, g2.id]);
    expect(getUserGroupIds("user-1").sort()).toEqual([g1.id, g2.id].sort());

    setUserGroups("user-1", [g3.id]);
    const ids = getUserGroupIds("user-1");
    expect(ids).toEqual([g3.id]);
    expect(ids).not.toContain(g1.id);
    expect(ids).not.toContain(g2.id);
  });

  it("setUserGroups with empty array clears all memberships", () => {
    const g1 = createUserGroup({ name: "Clear1" });
    setUserGroups("user-1", [g1.id]);
    setUserGroups("user-1", []);
    expect(getUserGroupIds("user-1")).toEqual([]);
  });

  it("setUserGroups does not affect other users memberships", () => {
    const g1 = createUserGroup({ name: "Isolation" });
    addGroupMembers(g1.id, ["user-2"]);
    setUserGroups("user-1", [g1.id]);
    setUserGroups("user-1", []); // clear user-1

    // user-2 still has their membership
    expect(getUserGroupIds("user-2")).toContain(g1.id);
  });
});
