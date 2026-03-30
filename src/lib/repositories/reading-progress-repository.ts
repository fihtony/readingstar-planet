import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import type { ReadingProgress } from "@/types";

interface ProgressRow {
  id: string;
  user_id: string;
  document_id: string;
  current_line: number;
  total_lines: number;
  updated_at: string;
}

interface ProgressInput {
  userId: string;
  documentId: string;
  currentLine: number;
  totalLines: number;
}

function rowToProgress(row: ProgressRow): ReadingProgress {
  return {
    id: row.id,
    userId: row.user_id,
    documentId: row.document_id,
    currentLine: row.current_line,
    totalLines: row.total_lines,
    updatedAt: row.updated_at,
  };
}

export function getReadingProgress(
  userId: string,
  documentId: string
): ReadingProgress | null {
  const db = getDatabase();
  const row = db
    .prepare(
      "SELECT * FROM reading_progress WHERE user_id = ? AND document_id = ?"
    )
    .get(userId, documentId) as ProgressRow | undefined;

  return row ? rowToProgress(row) : null;
}

export function upsertReadingProgress(
  input: ProgressInput
): ReadingProgress {
  const db = getDatabase();
  const existing = getReadingProgress(input.userId, input.documentId);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(
      `UPDATE reading_progress
       SET current_line = ?, total_lines = ?, updated_at = ?
       WHERE user_id = ? AND document_id = ?`
    ).run(
      input.currentLine,
      input.totalLines,
      now,
      input.userId,
      input.documentId
    );

    return {
      ...existing,
      currentLine: input.currentLine,
      totalLines: input.totalLines,
      updatedAt: now,
    };
  }

  const created: ReadingProgress = {
    id: uuidv4(),
    userId: input.userId,
    documentId: input.documentId,
    currentLine: input.currentLine,
    totalLines: input.totalLines,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO reading_progress (
      id,
      user_id,
      document_id,
      current_line,
      total_lines,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    created.id,
    created.userId,
    created.documentId,
    created.currentLine,
    created.totalLines,
    created.updatedAt
  );

  return created;
}