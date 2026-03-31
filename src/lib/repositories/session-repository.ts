import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import type { ReadingSession, FocusMode } from "@/types";

interface EndSessionOptions {
  focusMode?: FocusMode;
  letterHelperEnabled?: boolean;
  ttsUsed?: boolean;
}

interface CreateSessionInput {
  id?: string;
  userId: string;
  documentId: string;
  focusMode: FocusMode;
  letterHelperEnabled: boolean;
  ttsUsed: boolean;
}

interface SessionRow {
  id: string;
  user_id: string;
  document_id: string;
  started_at: string;
  ended_at: string | null;
  focus_mode: FocusMode;
  letter_helper_enabled: number;
  tts_used: number;
  lines_read: number;
}

function rowToSession(row: SessionRow): ReadingSession {
  return {
    id: row.id,
    userId: row.user_id,
    documentId: row.document_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    focusMode: row.focus_mode,
    letterHelperEnabled: row.letter_helper_enabled === 1,
    ttsUsed: row.tts_used === 1,
    linesRead: row.lines_read,
  };
}

export function getSessionById(id: string): ReadingSession | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM reading_sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function createSession(input: CreateSessionInput): ReadingSession {
  const db = getDatabase();
  const id = input.id ?? uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT OR IGNORE INTO reading_sessions (id, user_id, document_id, started_at, focus_mode, letter_helper_enabled, tts_used)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.userId,
    input.documentId,
    now,
    input.focusMode,
    input.letterHelperEnabled ? 1 : 0,
    input.ttsUsed ? 1 : 0
  );

  const row = db
    .prepare("SELECT * FROM reading_sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;

  return row ? rowToSession(row) : {
    id,
    userId: input.userId,
    documentId: input.documentId,
    startedAt: now,
    endedAt: null,
    focusMode: input.focusMode,
    letterHelperEnabled: input.letterHelperEnabled,
    ttsUsed: input.ttsUsed,
    linesRead: 0,
  };
}

export function endSession(
  id: string,
  linesRead: number,
  options?: EndSessionOptions
): ReadingSession | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE reading_sessions
     SET ended_at = ?,
         lines_read = ?,
         focus_mode = COALESCE(?, focus_mode),
         letter_helper_enabled = COALESCE(?, letter_helper_enabled),
         tts_used = COALESCE(?, tts_used)
     WHERE id = ?`
  ).run(
    now,
    linesRead,
    options?.focusMode ?? null,
    options?.letterHelperEnabled === undefined
      ? null
      : options.letterHelperEnabled
        ? 1
        : 0,
    options?.ttsUsed === undefined ? null : options.ttsUsed ? 1 : 0,
    id
  );

  const row = db
    .prepare("SELECT * FROM reading_sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function getSessionsByUser(userId: string): ReadingSession[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT * FROM reading_sessions WHERE user_id = ? ORDER BY started_at DESC"
    )
    .all(userId) as SessionRow[];
  return rows.map(rowToSession);
}
