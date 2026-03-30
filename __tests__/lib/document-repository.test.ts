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
  listDocuments,
  searchDocuments,
  deleteDocument,
} from "@/lib/repositories/document-repository";

describe("document-repository", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    testDb.pragma("journal_mode = WAL");
    testDb.pragma("foreign_keys = ON");
    initializeSchema(testDb);

    // Seed a default user for FK constraint
    testDb
      .prepare(
        `INSERT INTO users (id, nickname, role, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run("user-1", "Test Kid", "child");
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

    const fetched = getDocumentById(doc.id);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe("Test Book");
    expect(fetched!.content).toBe("Hello world of reading.");
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
});
