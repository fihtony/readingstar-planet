import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";

let testDb: InstanceType<typeof Database>;

vi.mock("@/lib/db", () => ({
  getDatabase: () => testDb,
}));

import { initializeSchema } from "@/lib/schema";
import { createDocument } from "@/lib/repositories/document-repository";
import {
  createSession,
  endSession,
  getSessionsByUser,
} from "@/lib/repositories/session-repository";

describe("session-repository", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    testDb.pragma("journal_mode = WAL");
    testDb.pragma("foreign_keys = ON");
    initializeSchema(testDb);

    // Seed user and document for FK constraints
    testDb
      .prepare(
        `INSERT INTO users (id, nickname, role, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run("user-1", "Test Kid", "child");

    createDocument({
      title: "Test Doc",
      content: "content",
      originalFilename: "test.txt",
      fileType: "txt",
      fileSize: 7,
      uploadedBy: "user-1",
    });
  });

  afterEach(() => {
    testDb.close();
  });

  it("creates a reading session", () => {
    // Get document ID from the DB
    const docId = (
      testDb.prepare("SELECT id FROM documents LIMIT 1").get() as { id: string }
    ).id;

    const session = createSession({
      userId: "user-1",
      documentId: docId,
      focusMode: "single-line",
      letterHelperEnabled: false,
      ttsUsed: false,
    });

    expect(session.id).toBeDefined();
    expect(session.userId).toBe("user-1");
    expect(session.documentId).toBe(docId);
  });

  it("ends a session with linesRead", () => {
    const docId = (
      testDb.prepare("SELECT id FROM documents LIMIT 1").get() as { id: string }
    ).id;

    const session = createSession({
      userId: "user-1",
      documentId: docId,
      focusMode: "single-line",
      letterHelperEnabled: true,
      ttsUsed: false,
    });

    const ended = endSession(session.id, 42);

    expect(ended).toBeDefined();
    expect(ended!.linesRead).toBe(42);
    expect(ended!.endedAt).toBeDefined();
  });

  it("returns null when ending non-existent session", () => {
    const result = endSession("no-such-session", 0);
    expect(result).toBeNull();
  });

  it("lists sessions by user", () => {
    const docId = (
      testDb.prepare("SELECT id FROM documents LIMIT 1").get() as { id: string }
    ).id;

    createSession({
      userId: "user-1",
      documentId: docId,
      focusMode: "single-line",
      letterHelperEnabled: false,
      ttsUsed: false,
    });
    createSession({
      userId: "user-1",
      documentId: docId,
      focusMode: "karaoke",
      letterHelperEnabled: false,
      ttsUsed: true,
    });

    const sessions = getSessionsByUser("user-1");
    expect(sessions).toHaveLength(2);
  });

  it("returns empty array for user with no sessions", () => {
    const sessions = getSessionsByUser("no-user");
    expect(sessions).toEqual([]);
  });
});
