import { randomUUID } from "crypto";
import { getDatabase } from "../db";
import type { UserGroup, UserRole, UserStatus } from "@/types";

interface UserGroupRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

function rowToUserGroup(row: UserGroupRow, memberCount?: number): UserGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    memberCount: memberCount ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listUserGroups(): UserGroup[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT ug.*,
         (SELECT COUNT(*) FROM user_group_members WHERE group_id = ug.id) AS member_count
       FROM user_groups ug
       ORDER BY ug.name ASC`
    )
    .all() as Array<UserGroupRow & { member_count: number }>;
  return rows.map((r) => rowToUserGroup(r, r.member_count));
}

export function getUserGroupById(id: string): UserGroup | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT ug.*,
         (SELECT COUNT(*) FROM user_group_members WHERE group_id = ug.id) AS member_count
       FROM user_groups ug
       WHERE ug.id = ?`
    )
    .get(id) as (UserGroupRow & { member_count: number }) | undefined;
  return row ? rowToUserGroup(row, row.member_count) : null;
}

export function createUserGroup(input: {
  name: string;
  description?: string;
}): UserGroup {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_groups (id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.name.trim(), (input.description ?? "").trim(), now, now);
  return getUserGroupById(id)!;
}

export function updateUserGroup(
  id: string,
  input: { name?: string; description?: string }
): UserGroup | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (input.name !== undefined) {
    sets.unshift("name = ?");
    values.unshift(input.name.trim());
  }
  if (input.description !== undefined) {
    sets.unshift("description = ?");
    values.unshift(input.description.trim());
  }

  if (sets.length === 1) return getUserGroupById(id);

  values.push(id);
  const result = db
    .prepare(`UPDATE user_groups SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
  if (result.changes === 0) return null;
  return getUserGroupById(id);
}

export function deleteUserGroup(
  id: string,
  force = false
): { success: boolean; memberCount?: number } {
  const db = getDatabase();
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM user_group_members WHERE group_id = ?")
    .get(id) as { count: number };

  if (row.count > 0 && !force) {
    return { success: false, memberCount: row.count };
  }

  // Downgrade any visibility entries that would become empty after deletion
  // The CASCADE on user_group_members and document_group_visibility handles FK
  // cleanup, but we need to handle the downgrade manually first.
  const transaction = db.transaction(() => {
    // Find document_groups that exclusively rely on this user_group
    const exclusiveDocGroups = db
      .prepare(
        `SELECT document_group_id FROM document_group_visibility
         WHERE user_group_id = ?
         AND document_group_id NOT IN (
           SELECT document_group_id FROM document_group_visibility
           WHERE user_group_id != ?
         )`
      )
      .all(id, id) as Array<{ document_group_id: string }>;

    for (const { document_group_id } of exclusiveDocGroups) {
      db.prepare(
        `UPDATE document_groups SET visibility = 'admin_only', updated_at = ? WHERE id = ?`
      ).run(new Date().toISOString(), document_group_id);
    }

    // Find documents that exclusively rely on this user_group
    const exclusiveDocs = db
      .prepare(
        `SELECT document_id FROM document_visibility
         WHERE user_group_id = ?
         AND document_id NOT IN (
           SELECT document_id FROM document_visibility
           WHERE user_group_id != ?
         )`
      )
      .all(id, id) as Array<{ document_id: string }>;

    for (const { document_id } of exclusiveDocs) {
      db.prepare(
        `UPDATE documents SET visibility = 'admin_only', updated_at = ? WHERE id = ?`
      ).run(new Date().toISOString(), document_id);
    }

    db.prepare("DELETE FROM user_groups WHERE id = ?").run(id);
  });

  transaction();
  return { success: true };
}

// --- Member management ---

export function listGroupMembers(
  groupId: string,
  filters?: {
    query?: string;
    role?: UserRole;
    status?: UserStatus;
    memberGroupId?: string;
  }
): Array<{
  id: string;
  email: string;
  name: string;
  nickname: string;
  role: string;
  status: string;
  assignedAt: string;
}> {
  const db = getDatabase();
  const conditions: string[] = ["ugm.group_id = ?"];
  const values: unknown[] = [groupId];

  if (filters?.query) {
    conditions.push("(u.email LIKE ? OR u.name LIKE ? OR u.nickname LIKE ?)");
    const q = `%${filters.query}%`;
    values.push(q, q, q);
  }
  if (filters?.role) {
    conditions.push("u.role = ?");
    values.push(filters.role);
  }
  if (filters?.status) {
    conditions.push("u.status = ?");
    values.push(filters.status);
  }
  if (filters?.memberGroupId) {
    conditions.push(
      `u.id IN (SELECT user_id FROM user_group_members WHERE group_id = ?)`
    );
    values.push(filters.memberGroupId);
  }

  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.nickname, u.role, u.status, ugm.assigned_at
       FROM user_group_members ugm
       JOIN users u ON u.id = ugm.user_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY u.email ASC`
    )
    .all(...values) as Array<{
    id: string;
    email: string;
    name: string;
    nickname: string;
    role: string;
    status: string;
    assigned_at: string;
  }>;

  return rows.map((r) => ({ ...r, assignedAt: r.assigned_at }));
}

export function addGroupMembers(groupId: string, userIds: string[]): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO user_group_members (user_id, group_id, assigned_at)
     VALUES (?, ?, ?)`
  );
  const transaction = db.transaction(() => {
    for (const userId of userIds) {
      stmt.run(userId, groupId, now);
    }
  });
  transaction();
}

export function removeGroupMember(groupId: string, userId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare(
      "DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?"
    )
    .run(groupId, userId);
  return result.changes > 0;
}

export function getUserGroupIds(userId: string): string[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT group_id FROM user_group_members WHERE user_id = ?")
    .all(userId) as Array<{ group_id: string }>;
  return rows.map((r) => r.group_id);
}

export function getUserGroupsForUser(userId: string): UserGroup[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT ug.*,
         (SELECT COUNT(*) FROM user_group_members WHERE group_id = ug.id) AS member_count
       FROM user_groups ug
       JOIN user_group_members ugm ON ugm.group_id = ug.id
       WHERE ugm.user_id = ?
       ORDER BY ug.name ASC`
    )
    .all(userId) as Array<UserGroupRow & { member_count: number }>;
  return rows.map((r) => rowToUserGroup(r, r.member_count));
}

export function setUserGroups(userId: string, groupIds: string[]): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM user_group_members WHERE user_id = ?").run(userId);
    const stmt = db.prepare(
      `INSERT INTO user_group_members (user_id, group_id, assigned_at) VALUES (?, ?, ?)`
    );
    for (const gid of groupIds) {
      stmt.run(userId, gid, now);
    }
  });
  transaction();
}
