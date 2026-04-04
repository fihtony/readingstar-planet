import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";

let testDb: InstanceType<typeof Database>;

vi.mock("@/lib/db", () => ({
  getDatabase: () => testDb,
}));

import { initializeSchema } from "@/lib/schema";
import {
  createDocumentGroup,
  deleteDocumentGroup,
  getDocumentGroupById,
  getDocumentGroupUserGroupIds,
  listDocumentGroups,
  ensureDefaultDocumentGroup,
  reorderDocumentGroups,
  setDocumentGroupVisibility,
} from "@/lib/repositories/document-group-repository";
import {
  createDocument,
  listDocuments,
  moveDocumentToGroup,
} from "@/lib/repositories/document-repository";
import { createUserGroup, deleteUserGroup } from "@/lib/repositories/user-group-repository";

describe("document-group-repository", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    testDb.pragma("journal_mode = WAL");
    testDb.pragma("foreign_keys = ON");
    initializeSchema(testDb);

    testDb
      .prepare(
        `INSERT INTO users (id, email, nickname, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .run("user-1", "test@example.com", "Test Kid", "user");
  });

  afterEach(() => {
    testDb.close();
  });

  // ── CRUD ─────────────────────────────────────────────────────────────────

  it("creates a group and retrieves it by id", () => {
    const group = createDocumentGroup({ userId: "user-1", name: "Science" });

    expect(group.id).toBeDefined();
    expect(group.name).toBe("Science");
    expect(group.userId).toBe("user-1");
    expect(group.position).toBe(0);

    const fetched = getDocumentGroupById(group.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(group.id);
    expect(fetched!.name).toBe("Science");
  });

  it("returns null for a non-existent group id", () => {
    const group = getDocumentGroupById("no-such-id");
    expect(group).toBeNull();
  });

  it("lists groups ordered by position ascending", () => {
    const g1 = createDocumentGroup({ userId: "user-1", name: "Alpha" });
    const g2 = createDocumentGroup({ userId: "user-1", name: "Beta" });
    const g3 = createDocumentGroup({ userId: "user-1", name: "Gamma" });

    const list = listDocumentGroups("user-1");
    expect(list).toHaveLength(3);
    expect(list[0].id).toBe(g1.id);
    expect(list[1].id).toBe(g2.id);
    expect(list[2].id).toBe(g3.id);
  });

  it("auto-increments position for each new group", () => {
    const g1 = createDocumentGroup({ userId: "user-1", name: "First" });
    const g2 = createDocumentGroup({ userId: "user-1", name: "Second" });
    const g3 = createDocumentGroup({ userId: "user-1", name: "Third" });

    expect(g1.position).toBe(0);
    expect(g2.position).toBe(1);
    expect(g3.position).toBe(2);
  });

  it("trims whitespace from group names", () => {
    const group = createDocumentGroup({ userId: "user-1", name: "  Trimmed  " });
    expect(group.name).toBe("Trimmed");
  });

  // ── ensureDefaultDocumentGroup ────────────────────────────────────────────

  it("creates a default 'My Books' group when none exists", () => {
    const group = ensureDefaultDocumentGroup("user-1");
    expect(group.name).toBe("My Books");
    expect(group.userId).toBe("user-1");
  });

  it("returns the existing first group without creating a duplicate", () => {
    const created = createDocumentGroup({ userId: "user-1", name: "Existing" });
    const ensured = ensureDefaultDocumentGroup("user-1");

    expect(ensured.id).toBe(created.id);
    expect(listDocumentGroups("user-1")).toHaveLength(1);
  });

  // ── reorderDocumentGroups ─────────────────────────────────────────────────

  it("reorders groups and persists the new positions", () => {
    const g1 = createDocumentGroup({ userId: "user-1", name: "Alpha" });
    const g2 = createDocumentGroup({ userId: "user-1", name: "Beta" });
    const g3 = createDocumentGroup({ userId: "user-1", name: "Gamma" });

    // Move g3 to the front
    const reordered = reorderDocumentGroups("user-1", [g3.id, g1.id, g2.id]);

    expect(reordered[0].id).toBe(g3.id);
    expect(reordered[1].id).toBe(g1.id);
    expect(reordered[2].id).toBe(g2.id);

    // Verify persistence
    const persisted = listDocumentGroups("user-1");
    expect(persisted[0].id).toBe(g3.id);
    expect(persisted[0].position).toBe(0);
    expect(persisted[1].position).toBe(1);
    expect(persisted[2].position).toBe(2);
  });

  it("reordering with a single group is a no-op", () => {
    const g = createDocumentGroup({ userId: "user-1", name: "Solo" });
    const result = reorderDocumentGroups("user-1", [g.id]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(g.id);
  });

  // ── group isolation between users ─────────────────────────────────────────

  it("does not leak groups between different users", () => {
    testDb
      .prepare(
        `INSERT INTO users (id, email, nickname, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .run("user-2", "test2@example.com", "Other Kid", "user");

    createDocumentGroup({ userId: "user-1", name: "User 1 Group" });
    createDocumentGroup({ userId: "user-2", name: "User 2 Group" });

    expect(listDocumentGroups("user-1")).toHaveLength(1);
    expect(listDocumentGroups("user-2")).toHaveLength(1);
    expect(listDocumentGroups("user-1")[0].name).toBe("User 1 Group");
    expect(listDocumentGroups("user-2")[0].name).toBe("User 2 Group");
  });

  // ── books and groups integration ──────────────────────────────────────────

  it("new documents are placed in the default group", () => {
    const doc = createDocument({
      title: "My Book",
      content: "hello",
      originalFilename: "book.txt",
      fileType: "txt",
      fileSize: 50,
      uploadedBy: "user-1",
    });

    const groups = listDocumentGroups("user-1");
    expect(groups).toHaveLength(1);
    expect(doc.groupId).toBe(groups[0].id);
    expect(doc.groupPosition).toBe(0);
  });

  it("assigns sequential group_position values within the same group", () => {
    const doc1 = createDocument({
      title: "Book A",
      content: "a",
      originalFilename: "a.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });
    const doc2 = createDocument({
      title: "Book B",
      content: "b",
      originalFilename: "b.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });
    const doc3 = createDocument({
      title: "Book C",
      content: "c",
      originalFilename: "c.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });

    expect(doc1.groupPosition).toBe(0);
    expect(doc2.groupPosition).toBe(1);
    expect(doc3.groupPosition).toBe(2);
  });

  it("moves a document from one group to another", () => {
    const doc = createDocument({
      title: "Traveller",
      content: "content",
      originalFilename: "travel.txt",
      fileType: "txt",
      fileSize: 20,
      uploadedBy: "user-1",
    });

    const targetGroup = createDocumentGroup({
      userId: "user-1",
      name: "Science",
    });

    const moved = moveDocumentToGroup(doc.id, targetGroup.id);
    expect(moved).not.toBeNull();
    expect(moved!.groupId).toBe(targetGroup.id);
  });

  it("returns null when moving a non-existent document", () => {
    const group = createDocumentGroup({
      userId: "user-1",
      name: "Target",
    });
    const result = moveDocumentToGroup("no-such-doc", group.id);
    expect(result).toBeNull();
  });

  it("returns null when moving to a non-existent group", () => {
    const doc = createDocument({
      title: "Book",
      content: "content",
      originalFilename: "book.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });
    const result = moveDocumentToGroup(doc.id, "no-such-group");
    expect(result).toBeNull();
  });

  // ── schema migration regression ───────────────────────────────────────────

  it("listDocuments includes groupId and groupPosition columns", () => {
    createDocument({
      title: "Schema Check",
      content: "content",
      originalFilename: "check.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });

    const docs = listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].groupId).toBeTruthy();
    expect(typeof docs[0].groupPosition).toBe("number");
  });

  it("initializeSchema can be called on an existing DB without errors (idempotent)", () => {
    // Second call to initializeSchema must not throw even with all tables and
    // columns already present (covers the ensureDocumentGroupingSchema guard).
    expect(() => {
      initializeSchema(testDb);
    }).not.toThrow();
  });

  it("stores and reads group-restricted visibility for document groups", () => {
    const group = createDocumentGroup({ userId: "user-1", name: "Restricted" });
    const classA = createUserGroup({ name: "Class A" });
    const classB = createUserGroup({ name: "Class B" });

    const updated = setDocumentGroupVisibility(group.id, "user_groups", [classA.id, classB.id]);

    expect(updated?.visibility).toBe("user_groups");
    expect(getDocumentGroupUserGroupIds(group.id).sort()).toEqual([classA.id, classB.id].sort());
  });

  it("removes deleted user groups from bookshelf visibility mappings", () => {
    const group = createDocumentGroup({ userId: "user-1", name: "Mapped" });
    const classA = createUserGroup({ name: "Class A" });
    const classB = createUserGroup({ name: "Class B" });
    setDocumentGroupVisibility(group.id, "user_groups", [classA.id, classB.id]);

    deleteUserGroup(classA.id, true);

    expect(getDocumentGroupUserGroupIds(group.id)).toEqual([classB.id]);
  });

  // ── deleteDocumentGroup ───────────────────────────────────────────────────

  it("deletes an empty group and returns success: true", () => {
    const group = createDocumentGroup({ userId: "user-1", name: "Deletable" });
    const result = deleteDocumentGroup(group.id);
    expect(result.success).toBe(true);
    expect(result.bookCount).toBeUndefined();
    expect(getDocumentGroupById(group.id)).toBeNull();
  });

  it("returns success: false with bookCount when group has books", () => {
    const group = createDocumentGroup({ userId: "user-1", name: "NonEmpty" });
    createDocument({
      title: "Physics",
      content: "E=mc2",
      originalFilename: "physics.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });
    // The createDocument auto-assigns to the first group for user-1
    // Verify the group is not empty
    const countRow = testDb.prepare("SELECT COUNT(*) AS count FROM documents WHERE group_id = ?").get(group.id) as { count: number };
    if (countRow.count === 0) {
      // Manually assign the doc to make the group non-empty
      const docId = (testDb.prepare("SELECT id FROM documents LIMIT 1").get() as { id: string }).id;
      testDb.prepare("UPDATE documents SET group_id = ? WHERE id = ?").run(group.id, docId);
    }
    const result = deleteDocumentGroup(group.id);
    expect(result.success).toBe(false);
    expect(result.bookCount).toBeGreaterThan(0);
    // Group must still exist
    expect(getDocumentGroupById(group.id)).not.toBeNull();
  });

  it("returns success: false when deleting a non-existent group", () => {
    const result = deleteDocumentGroup("non-existent-id");
    expect(result.success).toBe(false);
  });

  it("does not modify documents when deletion is blocked by book count", () => {
    const group = createDocumentGroup({ userId: "user-1", name: "Protected" });
    const doc = createDocument({
      title: "Guardian",
      content: "content",
      originalFilename: "g.txt",
      fileType: "txt",
      fileSize: 5,
      uploadedBy: "user-1",
    });
    testDb.prepare("UPDATE documents SET group_id = ? WHERE id = ?").run(group.id, doc.id);

    deleteDocumentGroup(group.id);

    // Book's group_id must remain pointing to the group (not nullified)
    const after = testDb.prepare("SELECT group_id FROM documents WHERE id = ?").get(doc.id) as { group_id: string | null };
    expect(after.group_id).toBe(group.id);
  });

  it("only affects the target group when multiple groups exist", () => {
    const keep = createDocumentGroup({ userId: "user-1", name: "Keep" });
    const remove = createDocumentGroup({ userId: "user-1", name: "Remove" });

    const result = deleteDocumentGroup(remove.id);
    expect(result.success).toBe(true);

    expect(getDocumentGroupById(keep.id)).not.toBeNull();
    expect(getDocumentGroupById(remove.id)).toBeNull();
    expect(listDocumentGroups("user-1")).toHaveLength(1);
    expect(listDocumentGroups("user-1")[0].id).toBe(keep.id);
  });

  it("admin can delete an empty group (API route permission check)", () => {
    // Confirm the repository layer has no role restriction — access control
    // is enforced at the API layer (checkPermission + admin role).
    const group = createDocumentGroup({ userId: "user-1", name: "Admin Removable" });
    const result = deleteDocumentGroup(group.id);
    expect(result.success).toBe(true);
    expect(getDocumentGroupById(group.id)).toBeNull();
  });
});
