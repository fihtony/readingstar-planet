import { randomUUID } from "crypto";
import { getDatabase } from "../db";
import type { UserReadingStats } from "@/types";

interface StatsRow {
  id: string;
  user_id: string;
  document_id: string;
  read_count: number;
  total_time_sec: number;
  timed_session_count: number;
  first_read_at: string | null;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToStats(row: StatsRow): UserReadingStats {
  return {
    id: row.id,
    userId: row.user_id,
    documentId: row.document_id,
    readCount: row.read_count,
    totalTimeSec: row.total_time_sec,
    timedSessionCount: row.timed_session_count,
    firstReadAt: row.first_read_at,
    lastReadAt: row.last_read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getUserDocumentStats(
  userId: string,
  documentId: string
): UserReadingStats | null {
  const db = getDatabase();
  const row = db
    .prepare(
      "SELECT * FROM user_reading_stats WHERE user_id = ? AND document_id = ?"
    )
    .get(userId, documentId) as StatsRow | undefined;
  return row ? rowToStats(row) : null;
}

export function getUserAllStats(userId: string): UserReadingStats[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM user_reading_stats WHERE user_id = ?")
    .all(userId) as StatsRow[];
  return rows.map(rowToStats);
}

/**
 * Increment read count for a user-document pair.
 * Also increments global documents.read_count.
 */
export function recordUserRead(
  userId: string,
  documentId: string
): UserReadingStats {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = getUserDocumentStats(userId, documentId);

  if (existing) {
    db.prepare(
      `UPDATE user_reading_stats
       SET read_count = read_count + 1, last_read_at = ?, updated_at = ?
       WHERE user_id = ? AND document_id = ?`
    ).run(now, now, userId, documentId);
  } else {
    db.prepare(
      `INSERT INTO user_reading_stats (id, user_id, document_id, read_count, first_read_at, last_read_at, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)`
    ).run(randomUUID(), userId, documentId, now, now, now, now);
  }

  // Also increment global read count
  db.prepare(
    "UPDATE documents SET read_count = read_count + 1 WHERE id = ?"
  ).run(documentId);

  return getUserDocumentStats(userId, documentId)!;
}

/**
 * Record a timed reading session duration for a user-document pair.
 */
export function recordReadingTime(
  userId: string,
  documentId: string,
  durationSec: number
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = getUserDocumentStats(userId, documentId);

  if (existing) {
    db.prepare(
      `UPDATE user_reading_stats
       SET total_time_sec = total_time_sec + ?,
           timed_session_count = timed_session_count + 1,
           last_read_at = ?,
           updated_at = ?
       WHERE user_id = ? AND document_id = ?`
    ).run(durationSec, now, now, userId, documentId);
  } else {
    db.prepare(
      `INSERT INTO user_reading_stats (id, user_id, document_id, read_count, total_time_sec, timed_session_count, first_read_at, last_read_at, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, 1, ?, ?, ?, ?)`
    ).run(randomUUID(), userId, documentId, durationSec, now, now, now, now);
  }
}

/**
 * Get user stats for all documents, used for my-read sorting.
 * Returns a map of documentId -> UserReadingStats.
 */
export function getUserStatsMap(
  userId: string
): Map<string, UserReadingStats> {
  const stats = getUserAllStats(userId);
  const map = new Map<string, UserReadingStats>();
  for (const s of stats) {
    map.set(s.documentId, s);
  }
  return map;
}
