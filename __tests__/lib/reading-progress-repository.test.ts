import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";

let testDb: InstanceType<typeof Database>;

vi.mock("@/lib/db", () => ({
  getDatabase: () => testDb,
}));

import { initializeSchema } from "@/lib/schema";
import { createDocument } from "@/lib/repositories/document-repository";
import {
  getReadingProgress,
  upsertReadingProgress,
} from "@/lib/repositories/reading-progress-repository";

describe("reading-progress-repository", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    testDb.pragma("journal_mode = WAL");
    testDb.pragma("foreign_keys = ON");
    initializeSchema(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  it("creates new progress for a document", () => {
    const document = createDocument({
      title: "Story",
      content: "One\nTwo",
      originalFilename: "story.txt",
      fileType: "txt",
      fileSize: 20,
      uploadedBy: "default-user",
    });

    const progress = upsertReadingProgress({
      userId: "default-user",
      documentId: document.id,
      currentLine: 1,
      totalLines: 2,
    });

    expect(progress.currentLine).toBe(1);
    expect(progress.totalLines).toBe(2);
  });

  it("updates existing progress for the same user and document", () => {
    const document = createDocument({
      title: "Story",
      content: "One\nTwo\nThree",
      originalFilename: "story.txt",
      fileType: "txt",
      fileSize: 20,
      uploadedBy: "default-user",
    });

    upsertReadingProgress({
      userId: "default-user",
      documentId: document.id,
      currentLine: 0,
      totalLines: 3,
    });
    const updated = upsertReadingProgress({
      userId: "default-user",
      documentId: document.id,
      currentLine: 2,
      totalLines: 3,
    });

    const fetched = getReadingProgress("default-user", document.id);
    expect(updated.currentLine).toBe(2);
    expect(fetched?.currentLine).toBe(2);
    expect(fetched?.totalLines).toBe(3);
  });
});