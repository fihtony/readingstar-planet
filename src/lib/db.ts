import fs from "node:fs";
import Database from "better-sqlite3";
import path from "path";
import { initializeSchema } from "./schema";
import { seedSampleDocuments } from "./sample-documents";

const DB_PATH = process.env.READINGSTAR_DB_PATH
  ? path.resolve(process.env.READINGSTAR_DB_PATH)
  : path.join(process.cwd(), "data", "reading-star.db");

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeSchema(db);
    seedSampleDocuments(db);
    initializeSchema(db);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
