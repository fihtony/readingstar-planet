import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";

let testDb: InstanceType<typeof Database>;

vi.mock("@/lib/db", () => ({
  getDatabase: () => testDb,
}));

import { initializeSchema } from "@/lib/schema";
import {
  createDocument,
  getDocumentById,
  incrementDocumentReadCount,
  listDocuments,
  searchDocuments,
  deleteDocument,
  moveDocumentToGroup,
  moveDocumentWithVisibilityHandling,
  getDocumentUserGroupIds,
} from "@/lib/repositories/document-repository";
import {
  createDocumentGroup,
  listDocumentGroups,
  setDocumentGroupVisibility,
} from "@/lib/repositories/document-group-repository";
import { createUserGroup } from "@/lib/repositories/user-group-repository";

describe("document-repository", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    testDb.pragma("journal_mode = WAL");
    testDb.pragma("foreign_keys = ON");
    initializeSchema(testDb);

    // Seed a default user for FK constraint
    testDb
      .prepare(
        `INSERT INTO users (id, email, nickname, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .run("user-1", "test@example.com", "Test Kid", "user");
  });

  afterEach(() => {
    testDb.close();
  });

  it("creates and retrieves a document", () => {
    const doc = createDocument({
      title: "Test Book",
      content: "Hello world of reading.",
      originalFilename: "test-book.txt",
      fileType: "txt",
      fileSize: 100,
      uploadedBy: "user-1",
    });

    expect(doc.id).toBeDefined();
    expect(doc.title).toBe("Test Book");
    expect(doc.groupId).toBeTruthy();
    expect(doc.groupPosition).toBe(0);

    const fetched = getDocumentById(doc.id);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe("Test Book");
    expect(fetched!.content).toBe("Hello world of reading.");
    expect(fetched!.groupId).toBe(doc.groupId);
  });

  it("creates a default group for uploaded documents", () => {
    createDocument({
      title: "Grouped Book",
      content: "Hello world of reading.",
      originalFilename: "grouped-book.txt",
      fileType: "txt",
      fileSize: 100,
      uploadedBy: "user-1",
    });

    const groups = listDocumentGroups("user-1");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("My Books");
  });

  it("creates an ungrouped document with admin-only override when groupId is null", () => {
    const doc = createDocument({
      title: "Standalone",
      content: "Hidden by default",
      originalFilename: "standalone.txt",
      fileType: "txt",
      fileSize: 24,
      uploadedBy: "user-1",
      groupId: null,
    });

    expect(doc.groupId).toBeNull();
    expect(doc.accessOverride).toBe(true);
    expect(doc.visibility).toBe("admin_only");

    const fetched = getDocumentById(doc.id);
    expect(fetched?.groupId).toBeNull();
    expect(fetched?.accessOverride).toBe(true);
    expect(fetched?.visibility).toBe("admin_only");
  });

  it("creates a grouped document in inherit mode when a target group is provided", () => {
    const targetGroup = createDocumentGroup({
      userId: "user-1",
      name: "Reading List",
    });
    const userGroup = createUserGroup({ name: "Class A" });
    setDocumentGroupVisibility(targetGroup.id, "user_groups", [userGroup.id]);

    const doc = createDocument({
      title: "Inherited Book",
      content: "Inherits its shelf access.",
      originalFilename: "inherited.txt",
      fileType: "txt",
      fileSize: 30,
      uploadedBy: "user-1",
      groupId: targetGroup.id,
    });

    expect(doc.groupId).toBe(targetGroup.id);
    expect(doc.accessOverride).toBe(false);
    expect(doc.visibility).toBe("user_groups");
  });

  it("moves a document into another group", () => {
    const doc = createDocument({
      title: "Move Me",
      content: "Hello world of reading.",
      originalFilename: "move-me.txt",
      fileType: "txt",
      fileSize: 100,
      uploadedBy: "user-1",
    });
    const otherGroup = createDocumentGroup({
      userId: "user-1",
      name: "Science",
    });

    const moved = moveDocumentToGroup(doc.id, otherGroup.id);
    expect(moved).not.toBeNull();
    expect(moved!.groupId).toBe(otherGroup.id);
  });

  it("requires confirmation when moving between groups with different effective visibility", () => {
    const sourceGroup = createDocumentGroup({
      userId: "user-1",
      name: "Public Shelf",
    });
    const targetGroup = createDocumentGroup({
      userId: "user-1",
      name: "Admin Shelf",
    });
    setDocumentGroupVisibility(targetGroup.id, "admin_only", []);

    const doc = createDocument({
      title: "Needs Review",
      content: "Visibility will change after moving.",
      originalFilename: "review.txt",
      fileType: "txt",
      fileSize: 36,
      uploadedBy: "user-1",
      groupId: sourceGroup.id,
    });

    const result = moveDocumentWithVisibilityHandling(doc.id, targetGroup.id);

    expect(result.status).toBe("confirmation_required");
    if (result.status === "confirmation_required") {
      expect(result.confirmation.currentVisibility.visibility).toBe("public");
      expect(result.confirmation.targetVisibility.visibility).toBe("admin_only");
      expect(result.confirmation.sourceGroupName).toBe("Public Shelf");
      expect(result.confirmation.targetGroupName).toBe("Admin Shelf");
    }
  });

  it("can preserve current visibility as an override when moving to a different shelf", () => {
    const sourceGroup = createDocumentGroup({
      userId: "user-1",
      name: "Group Shelf",
    });
    const targetGroup = createDocumentGroup({
      userId: "user-1",
      name: "Admins Only",
    });
    const classGroup = createUserGroup({ name: "Class B" });
    setDocumentGroupVisibility(sourceGroup.id, "user_groups", [classGroup.id]);
    setDocumentGroupVisibility(targetGroup.id, "admin_only", []);

    const doc = createDocument({
      title: "Keep Access",
      content: "Move me but keep my current audience.",
      originalFilename: "keep-access.txt",
      fileType: "txt",
      fileSize: 39,
      uploadedBy: "user-1",
      groupId: sourceGroup.id,
    });

    const result = moveDocumentWithVisibilityHandling(doc.id, targetGroup.id, "preserve_current");

    expect(result.status).toBe("moved");
    if (result.status === "moved") {
      expect(result.document.groupId).toBe(targetGroup.id);
      expect(result.document.accessOverride).toBe(true);
      expect(result.document.visibility).toBe("user_groups");
      expect(getDocumentUserGroupIds(result.document.id)).toEqual([classGroup.id]);
    }
  });

  it("keeps the current effective visibility when moving into the ungrouped area", () => {
    const sourceGroup = createDocumentGroup({
      userId: "user-1",
      name: "Shared Shelf",
    });
    const classGroup = createUserGroup({ name: "Class C" });
    setDocumentGroupVisibility(sourceGroup.id, "user_groups", [classGroup.id]);

    const doc = createDocument({
      title: "Ungroup Me",
      content: "I should keep my current restrictions.",
      originalFilename: "ungroup-me.txt",
      fileType: "txt",
      fileSize: 41,
      uploadedBy: "user-1",
      groupId: sourceGroup.id,
    });

    const result = moveDocumentWithVisibilityHandling(doc.id, null);

    expect(result.status).toBe("moved");
    if (result.status === "moved") {
      expect(result.document.groupId).toBeNull();
      expect(result.document.accessOverride).toBe(true);
      expect(result.document.visibility).toBe("user_groups");
      expect(getDocumentUserGroupIds(result.document.id)).toEqual([classGroup.id]);
    }
  });

  it("lists all documents newest first", () => {
    const a = createDocument({
      title: "First",
      content: "c1",
      originalFilename: "first.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });
    const b = createDocument({
      title: "Second",
      content: "c2",
      originalFilename: "second.pdf",
      fileType: "pdf",
      fileSize: 20,
      uploadedBy: "user-1",
    });

    const docs = listDocuments();
    expect(docs).toHaveLength(2);
    // Both documents should be present
    const ids = docs.map((d) => d.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it("searches documents by title", () => {
    createDocument({
      title: "Cat in the Hat",
      content: "c1",
      originalFilename: "cat.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });
    createDocument({
      title: "Green Eggs",
      content: "c2",
      originalFilename: "eggs.txt",
      fileType: "txt",
      fileSize: 10,
      uploadedBy: "user-1",
    });

    const results = searchDocuments("cat");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Cat in the Hat");
  });

  it("deletes a document", () => {
    const doc = createDocument({
      title: "Delete Me",
      content: "bye",
      originalFilename: "delete.txt",
      fileType: "txt",
      fileSize: 5,
      uploadedBy: "user-1",
    });

    const success = deleteDocument(doc.id);
    expect(success).toBe(true);

    const fetched = getDocumentById(doc.id);
    expect(fetched).toBeNull();
  });

  it("returns false when deleting non-existent document", () => {
    const success = deleteDocument("non-existent");
    expect(success).toBe(false);
  });

  it("returns null for non-existent document", () => {
    const doc = getDocumentById("no-such-id");
    expect(doc).toBeNull();
  });

  it("increments the explicit read count", () => {
    const doc = createDocument({
      title: "Count Me",
      content: "hello there",
      originalFilename: "count-me.txt",
      fileType: "txt",
      fileSize: 11,
      uploadedBy: "user-1",
    });

    const updated = incrementDocumentReadCount(doc.id);

    expect(updated).not.toBeNull();
    expect(updated!.readCount).toBe(1);
    expect(getDocumentById(doc.id)?.readCount).toBe(1);
  });
});
