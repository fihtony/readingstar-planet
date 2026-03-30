import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initializeSchema } from "@/lib/schema";
import {
  SAMPLE_DOCUMENTS,
  seedSampleDocuments,
} from "@/lib/sample-documents";

describe("sample-documents", () => {
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it("seeds sample books once", () => {
    const seededCount = seedSampleDocuments(db);
    const rows = db
      .prepare("SELECT id, title FROM documents ORDER BY title ASC")
      .all() as Array<{ id: string; title: string }>;

    expect(seededCount).toBe(SAMPLE_DOCUMENTS.length);
    expect(rows).toHaveLength(SAMPLE_DOCUMENTS.length);
    expect(rows.some((row) => row.title === "The Brave Little Otter")).toBe(true);
    expect(rows.some((row) => row.title === "Converting Energy to Motion")).toBe(true);
  });

  it("does not duplicate sample books on repeated runs", () => {
    seedSampleDocuments(db);
    const secondSeedCount = seedSampleDocuments(db);
    const count = db
      .prepare("SELECT COUNT(*) as count FROM documents")
      .get() as { count: number };

    expect(secondSeedCount).toBe(0);
    expect(count.count).toBe(SAMPLE_DOCUMENTS.length);
  });
});