import { randomUUID } from "crypto";
import { getDatabase } from "../db";
import { rowToUser } from "../auth";
import type { User, UserRole, UserStatus } from "@/types";

interface CreateUserInput {
  email: string;
  role?: UserRole;
  adminNotes?: string;
  googleId?: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  status?: UserStatus;
}

interface UpdateUserInput {
  role?: UserRole;
  status?: UserStatus;
  adminNotes?: string;
  nickname?: string;
  avatarUrl?: string;
  avatarSource?: "google" | "custom";
  personalNote?: string;
  name?: string;
  googleId?: string;
  lastLoginAt?: string;
}

export function createUser(input: CreateUserInput): User {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, google_id, name, nickname, avatar_url, role, status, admin_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.email,
    input.googleId ?? null,
    input.name ?? "",
    input.nickname ?? "",
    input.avatarUrl ?? "",
    input.role ?? "user",
    input.status ?? "pending_verification",
    input.adminNotes ?? "",
    now,
    now
  );

  return rowToUser(
    db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Parameters<typeof rowToUser>[0]
  );
}

export function updateUser(id: string, input: UpdateUserInput): User | null {
  const db = getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.role !== undefined) {
    sets.push("role = ?");
    values.push(input.role);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    values.push(input.status);
    if (input.status === "deleted") {
      sets.push("deleted_at = ?");
      values.push(new Date().toISOString());
      // Anonymize PII on deletion (GDPR Art.17 — Right to Erasure)
      sets.push("email = 'deleted_' || id || '@deleted.invalid'");
      sets.push("name = ''");
      sets.push("nickname = ''");
      sets.push("personal_note = ''");
      sets.push("google_id = NULL");
      sets.push("avatar_url = ''");
    } else {
      sets.push("deleted_at = NULL");
    }
  }
  if (input.adminNotes !== undefined) {
    sets.push("admin_notes = ?");
    values.push(input.adminNotes);
  }
  if (input.nickname !== undefined) {
    sets.push("nickname = ?");
    values.push(input.nickname);
  }
  if (input.avatarUrl !== undefined) {
    sets.push("avatar_url = ?");
    values.push(input.avatarUrl);
  }
  if (input.avatarSource !== undefined) {
    sets.push("avatar_source = ?");
    values.push(input.avatarSource);
  }
  if (input.personalNote !== undefined) {
    sets.push("personal_note = ?");
    values.push(input.personalNote);
  }
  if (input.name !== undefined) {
    sets.push("name = ?");
    values.push(input.name);
  }
  if (input.googleId !== undefined) {
    sets.push("google_id = ?");
    values.push(input.googleId);
  }
  if (input.lastLoginAt !== undefined) {
    sets.push("last_login_at = ?");
    values.push(input.lastLoginAt);
  }

  if (sets.length === 0) return getUserByIdDirect(id);

  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getUserByIdDirect(id);
}

export function listUsers(includeDeleted = false): User[] {
  const db = getDatabase();
  const query = includeDeleted
    ? "SELECT * FROM users ORDER BY created_at DESC"
    : "SELECT * FROM users WHERE status != 'deleted' ORDER BY created_at DESC";
  const rows = db.prepare(query).all();
  return rows.map((row) => rowToUser(row as Parameters<typeof rowToUser>[0]));
}

export function listAllUsers(): User[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return rows.map((row) => rowToUser(row as Parameters<typeof rowToUser>[0]));
}

export function countActiveAdmins(): number {
  const db = getDatabase();
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'"
  ).get() as { count: number };
  return row.count;
}

function getUserByIdDirect(id: string): User | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? rowToUser(row as Parameters<typeof rowToUser>[0]) : null;
}
