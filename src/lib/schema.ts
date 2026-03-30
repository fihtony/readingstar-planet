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

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'txt')),
      file_size INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
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
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_user ON reading_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_document ON reading_sessions(document_id);
    CREATE INDEX IF NOT EXISTS idx_reading_progress_user_doc ON reading_progress(user_id, document_id);
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_app_metadata_updated_at ON app_metadata(updated_at);
  `);

  // Seed a default user for MVP (no auth yet)
  db.prepare(
    `INSERT OR IGNORE INTO users (id, nickname, role, created_at, updated_at)
     VALUES ('default-user', 'Reader', 'child', datetime('now'), datetime('now'))`
  ).run();
}
