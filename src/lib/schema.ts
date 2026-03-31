import { randomUUID } from "crypto";
import type Database from "better-sqlite3";

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT 'owl-default',
      role TEXT NOT NULL CHECK (role IN ('child', 'parent', 'educator')),
      locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'zh')),
      parent_id TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS document_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'txt')),
      file_size INTEGER NOT NULL,
      read_count INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL,
      group_id TEXT,
      group_position INTEGER NOT NULL DEFAULT 0,
      icon TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES document_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      started_at DATETIME NOT NULL DEFAULT (datetime('now')),
      ended_at DATETIME,
      focus_mode TEXT NOT NULL DEFAULT 'single-line' CHECK (focus_mode IN ('single-line', 'sliding-window', 'karaoke')),
      letter_helper_enabled INTEGER NOT NULL DEFAULT 0,
      tts_used INTEGER NOT NULL DEFAULT 0,
      lines_read INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      current_line INTEGER NOT NULL DEFAULT 0,
      total_lines INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(user_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('streak', 'effort', 'milestone')),
      name TEXT NOT NULL,
      earned_at DATETIME NOT NULL DEFAULT (datetime('now')),
      metadata TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      font_family TEXT NOT NULL DEFAULT 'opendyslexic' CHECK (font_family IN ('opendyslexic', 'system')),
      font_size INTEGER NOT NULL DEFAULT 20 CHECK (font_size BETWEEN 14 AND 32),
      line_spacing REAL NOT NULL DEFAULT 1.8 CHECK (line_spacing BETWEEN 1.5 AND 2.5),
      mask_opacity REAL NOT NULL DEFAULT 0.7 CHECK (mask_opacity BETWEEN 0 AND 0.9),
      tts_speed REAL NOT NULL DEFAULT 0.8 CHECK (tts_speed BETWEEN 0.5 AND 2.0),
      tts_pitch REAL NOT NULL DEFAULT 1.05 CHECK (tts_pitch BETWEEN 0.5 AND 2.0),
      tts_voice TEXT NOT NULL DEFAULT '',
      daily_time_limit INTEGER NOT NULL DEFAULT 30 CHECK (daily_time_limit BETWEEN 5 AND 120),
      theme TEXT NOT NULL DEFAULT 'flashlight' CHECK (theme IN ('flashlight', 'magnifier', 'magic-wand')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_document_groups_user_position ON document_groups(user_id, position);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_user ON reading_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_document ON reading_sessions(document_id);
    CREATE INDEX IF NOT EXISTS idx_reading_progress_user_doc ON reading_progress(user_id, document_id);
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_app_metadata_updated_at ON app_metadata(updated_at);
  `);

  ensureDocumentGroupingSchema(db);

  // Seed a default user for MVP (no auth yet)
  db.prepare(
    `INSERT OR IGNORE INTO users (id, nickname, role, created_at, updated_at)
     VALUES ('default-user', 'Reader', 'child', datetime('now'), datetime('now'))`
  ).run();
}

function ensureDocumentGroupingSchema(db: Database.Database): void {
  if (!hasColumn(db, "documents", "group_id")) {
    db.prepare("ALTER TABLE documents ADD COLUMN group_id TEXT").run();
  }

  if (!hasColumn(db, "documents", "group_position")) {
    db.prepare(
      "ALTER TABLE documents ADD COLUMN group_position INTEGER NOT NULL DEFAULT 0"
    ).run();
  }

  if (!hasColumn(db, "documents", "icon")) {
    db.prepare("ALTER TABLE documents ADD COLUMN icon TEXT").run();
  }

  if (!hasColumn(db, "documents", "read_count")) {
    db.prepare(
      "ALTER TABLE documents ADD COLUMN read_count INTEGER NOT NULL DEFAULT 0"
    ).run();

    db.exec(`
      UPDATE documents
      SET read_count = (
        SELECT COUNT(*)
        FROM reading_sessions
        WHERE reading_sessions.document_id = documents.id
      )
    `);
  }

  // Create the composite index now that both columns are guaranteed to exist.
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_documents_group_position ON documents(group_id, group_position)`
  );

  const usersWithDocuments = db.prepare(
    `SELECT DISTINCT uploaded_by AS user_id
     FROM documents`
  ).all() as Array<{ user_id: string }>;

  const findFirstGroup = db.prepare(
    `SELECT id FROM document_groups WHERE user_id = ? ORDER BY position ASC, created_at ASC LIMIT 1`
  );
  const createGroup = db.prepare(
    `INSERT INTO document_groups (id, user_id, name, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const listDocsWithoutGroup = db.prepare(
    `SELECT id, uploaded_by
     FROM documents
     WHERE group_id IS NULL OR group_id = ''
     ORDER BY uploaded_by ASC, created_at DESC`
  );
  const maxDocPosition = db.prepare(
    `SELECT COALESCE(MAX(group_position), -1) AS max_position FROM documents WHERE group_id = ?`
  );
  const assignDocGroup = db.prepare(
    `UPDATE documents
     SET group_id = ?, group_position = ?, updated_at = ?
     WHERE id = ?`
  );

  const groupIdByUser = new Map<string, string>();
  const nextDocPositionByGroup = new Map<string, number>();
  const now = new Date().toISOString();

  for (const row of usersWithDocuments) {
    const existingGroup = findFirstGroup.get(row.user_id) as { id: string } | undefined;

    if (existingGroup) {
      groupIdByUser.set(row.user_id, existingGroup.id);
      continue;
    }

    const groupId = randomUUID();
    createGroup.run(groupId, row.user_id, "My Books", 0, now, now);
    groupIdByUser.set(row.user_id, groupId);
  }

  const docsWithoutGroup = listDocsWithoutGroup.all() as Array<{
    id: string;
    uploaded_by: string;
  }>;

  for (const row of docsWithoutGroup) {
    let groupId = groupIdByUser.get(row.uploaded_by);

    if (!groupId) {
      const createdGroupId = randomUUID();
      createGroup.run(createdGroupId, row.uploaded_by, "My Books", 0, now, now);
      groupIdByUser.set(row.uploaded_by, createdGroupId);
      groupId = createdGroupId;
    }

    if (!nextDocPositionByGroup.has(groupId)) {
      const maxPositionRow = maxDocPosition.get(groupId) as { max_position: number };
      nextDocPositionByGroup.set(groupId, maxPositionRow.max_position + 1);
    }

    const nextPosition = nextDocPositionByGroup.get(groupId)!;
    assignDocGroup.run(groupId, nextPosition, now, row.id);
    nextDocPositionByGroup.set(groupId, nextPosition + 1);
  }
}

function hasColumn(
  db: Database.Database,
  tableName: string,
  columnName: string
): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === columnName);
}
