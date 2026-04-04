import { randomUUID } from "crypto";
import type Database from "better-sqlite3";

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      avatar_source TEXT NOT NULL DEFAULT 'google'
        CHECK (avatar_source IN ('google', 'custom')),
      personal_note TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin', 'user')),
      status TEXT NOT NULL DEFAULT 'pending_verification'
        CHECK (status IN ('active', 'inactive', 'deleted', 'pending_verification')),
      admin_notes TEXT NOT NULL DEFAULT '',
      last_login_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ip_address TEXT,
      raw_user_agent TEXT NOT NULL DEFAULT '',
      browser_name TEXT NOT NULL DEFAULT '',
      browser_version TEXT NOT NULL DEFAULT '',
      os_name TEXT NOT NULL DEFAULT '',
      os_version TEXT NOT NULL DEFAULT '',
      device_type TEXT NOT NULL DEFAULT 'unknown'
        CHECK (device_type IN ('desktop', 'tablet', 'mobile', 'bot', 'unknown')),
      device_model TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      last_seen_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_activity_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      ip_address TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_user ON user_activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_action ON user_activity_log(action);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created ON user_activity_log(created_at);

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      detail TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);

    CREATE TABLE IF NOT EXISTS user_reading_stats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      read_count INTEGER NOT NULL DEFAULT 0,
      total_time_sec INTEGER NOT NULL DEFAULT 0,
      timed_session_count INTEGER NOT NULL DEFAULT 0,
      first_read_at DATETIME,
      last_read_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(user_id, document_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_reading_stats_user ON user_reading_stats(user_id);

    CREATE TABLE IF NOT EXISTS document_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
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
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (group_id) REFERENCES document_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      started_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
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
      updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(user_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('streak', 'effort', 'milestone')),
      name TEXT NOT NULL,
      earned_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
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
      locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'zh')),
      updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_document_groups_user_position ON document_groups(user_id, position);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_user ON reading_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_document ON reading_sessions(document_id);
    CREATE INDEX IF NOT EXISTS idx_reading_progress_user_doc ON reading_progress(user_id, document_id);
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_app_metadata_updated_at ON app_metadata(updated_at);

    CREATE TABLE IF NOT EXISTS rate_limit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      attempt_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_time ON rate_limit_log(key, attempt_at);
  `);

  migrateUsersTable(db);
  migrateUsersTableColumns(db);
  // Create user indexes after migrations so columns are guaranteed to exist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
  `);
  ensureUserSettingsLocale(db);
  ensureDocumentGroupingSchema(db);
  seedDefaultAppMetadata(db);
  seedInitialAdmin(db);
}

/**
 * Incrementally add any new columns that may be missing from an existing users
 * table (e.g. databases created at an intermediate schema version that already
 * had the `email` column but not the full OAuth column set).
 */
function migrateUsersTableColumns(db: Database.Database): void {
  // google_id can't use UNIQUE in ALTER TABLE; create a unique index instead.
  if (!hasColumn(db, "users", "google_id")) {
    db.prepare("ALTER TABLE users ADD COLUMN google_id TEXT").run();
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)"
    );
  }
  if (!hasColumn(db, "users", "name")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''"
    ).run();
  }
  if (!hasColumn(db, "users", "avatar_url")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''"
    ).run();
  }
  if (!hasColumn(db, "users", "avatar_source")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN avatar_source TEXT NOT NULL DEFAULT 'google'"
    ).run();
  }
  if (!hasColumn(db, "users", "personal_note")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN personal_note TEXT NOT NULL DEFAULT ''"
    ).run();
  }
  if (!hasColumn(db, "users", "status")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"
    ).run();
  }
  if (!hasColumn(db, "users", "admin_notes")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN admin_notes TEXT NOT NULL DEFAULT ''"
    ).run();
  }
  if (!hasColumn(db, "users", "last_login_at")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN last_login_at DATETIME"
    ).run();
  }
  if (!hasColumn(db, "users", "deleted_at")) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN deleted_at DATETIME"
    ).run();
  }
}

/**
 * Migrate users table from old schema (child/parent/educator roles)
 * to new schema (admin/user roles + OAuth fields).
 */
function migrateUsersTable(db: Database.Database): void {
  // Check if migration is needed by looking for old role values
  if (!hasColumn(db, "users", "email")) {
    // Old schema detected – need to migrate
    // SQLite doesn't support ALTER COLUMN, so we recreate via migration
    const oldUsers = db.prepare("SELECT * FROM users").all() as Array<{
      id: string;
      nickname: string;
      avatar: string;
      role: string;
      locale: string;
      parent_id: string | null;
      created_at: string;
      updated_at: string;
    }>;

    // Use the safe SQLite migration pattern:
    // 1. Create new table with a temp name  (no FK-reference updates triggered)
    // 2. Copy data
    // 3. DROP the original table           (no FK-reference updates triggered)
    // 4. RENAME temp → original            (SQLite would only update refs pointing
    //                                        at the temp name, of which there are
    //                                        none, so child table schemas are left
    //                                        pointing at the original "users" name)
    // This avoids the SQLite 3.26+ auto-update of FK references that would leave
    // child tables (auth_sessions, etc.) with a stale "REFERENCES users_old" after
    // the old table is dropped.
    db.pragma("foreign_keys = OFF");

    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        google_id TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        nickname TEXT NOT NULL DEFAULT '',
        avatar_url TEXT NOT NULL DEFAULT '',
        avatar_source TEXT NOT NULL DEFAULT 'google'
          CHECK (avatar_source IN ('google', 'custom')),
        personal_note TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user'
          CHECK (role IN ('admin', 'user')),
        status TEXT NOT NULL DEFAULT 'pending_verification'
          CHECK (status IN ('active', 'inactive', 'deleted', 'pending_verification')),
        admin_notes TEXT NOT NULL DEFAULT '',
        last_login_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at DATETIME
      );
    `);

    // Migrate old users into users_new: default-user becomes admin
    for (const u of oldUsers) {
      const newRole = u.id === "default-user" ? "admin" : "user";
      const email = u.id === "default-user" ? "default@readingstar.local" : `${u.id}@readingstar.local`;
      db.prepare(
        `INSERT INTO users_new (id, email, name, nickname, avatar_url, avatar_source, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      ).run(
        u.id,
        email,
        u.nickname,
        u.nickname,
        "",
        "google",
        newRole,
        u.created_at,
        u.updated_at
      );
    }

    // Drop old table (does NOT update FK references in child tables)
    db.exec("DROP TABLE users");
    // Rename temp table to canonical name; SQLite 3.26+ would only update FK refs
    // pointing at "users_new" – there are none – so child table schemas keep their
    // existing "REFERENCES users" text, which now resolves correctly.
    db.exec("ALTER TABLE users_new RENAME TO users");

    db.pragma("foreign_keys = ON");
  }
}

/**
 * Add locale column to user_settings if missing (incremental migration).
 */
function ensureUserSettingsLocale(db: Database.Database): void {
  if (!hasColumn(db, "user_settings", "locale")) {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'"
    ).run();
  }
}

/**
 * Seed default global settings into app_metadata.
 */
function seedDefaultAppMetadata(db: Database.Database): void {
  const defaults: Record<string, string> = {
    registration_policy: "invite-only",
    default_font_family: "opendyslexic",
    default_font_size: "20",
    default_line_spacing: "1.8",
    default_mask_opacity: "0.7",
    default_tts_speed: "0.8",
    default_tts_pitch: "1.05",
    default_theme: "flashlight",
  };

  const insert = db.prepare(
    `INSERT OR IGNORE INTO app_metadata (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
  );

  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value);
  }
}

/**
 * Seed initial admin from INITIAL_ADMIN_EMAIL env var.
 *
 * Runs when:
 *   1. INITIAL_ADMIN_EMAIL is configured, AND
 *   2. That email is not already in the users table, AND
 *   3. There are no "real" (non-legacy) admin users yet.
 *
 * Legacy admins are those created by the old single-user migration whose email
 * ends with "@readingstar.local".  They cannot log in with Google, so we still
 * allow the initial admin to be seeded even when they exist.
 *
 * Once a real admin (with a proper email) exists, the env var is ignored –
 * changing INITIAL_ADMIN_EMAIL after that will not create a new seed user.
 */
function seedInitialAdmin(db: Database.Database): void {
  const initialEmail = process.env.INITIAL_ADMIN_EMAIL;
  if (!initialEmail) return;

  // Don't seed if this email is already registered
  const existingByEmail = db.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE email = ?"
  ).get(initialEmail) as { count: number };
  if (existingByEmail.count > 0) return;

  // Don't seed if a real admin already exists (non-legacy email)
  const realAdminCount = db.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND email NOT LIKE '%@readingstar.local'"
  ).get() as { count: number };
  if (realAdminCount.count > 0) return;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, name, nickname, role, status, created_at, updated_at)
     VALUES (?, ?, '', '', 'admin', 'pending_verification', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
  ).run(id, initialEmail);
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
