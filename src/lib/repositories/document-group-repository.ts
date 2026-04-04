import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import type { DocumentGroup, VisibilityType } from "@/types";

const DEFAULT_DOCUMENT_GROUP_NAME = "My Books";

interface DocumentGroupRow {
  id: string;
  user_id: string;
  name: string;
  position: number;
  visibility: string;
  created_at: string;
  updated_at: string;
}

function rowToDocumentGroup(row: DocumentGroupRow): DocumentGroup {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    position: row.position,
    visibility: (row.visibility ?? "public") as VisibilityType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDocumentGroupById(id: string): DocumentGroup | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM document_groups WHERE id = ?")
    .get(id) as DocumentGroupRow | undefined;

  return row ? rowToDocumentGroup(row) : null;
}

export function listDocumentGroups(userId?: string): DocumentGroup[] {
  const db = getDatabase();
  const rows = userId
    ? (db
        .prepare(
          `SELECT *
           FROM document_groups
           WHERE user_id = ?
           ORDER BY position ASC, created_at ASC`
        )
        .all(userId) as DocumentGroupRow[])
    : (db
        .prepare(
          `SELECT *
           FROM document_groups
           ORDER BY position ASC, created_at ASC`
        )
        .all() as DocumentGroupRow[]);

  return rows.map(rowToDocumentGroup);
}

export function ensureDefaultDocumentGroup(userId: string): DocumentGroup {
  const existing = listDocumentGroups(userId)[0];
  if (existing) {
    return existing;
  }

  return createDocumentGroup({
    userId,
    name: DEFAULT_DOCUMENT_GROUP_NAME,
  });
}

export function createDocumentGroup(input: {
  userId: string;
  name: string;
}): DocumentGroup {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxPositionRow = db.prepare(
    `SELECT COALESCE(MAX(position), -1) AS max_position
     FROM document_groups
     WHERE user_id = ?`
  ).get(input.userId) as { max_position: number };
  const position = maxPositionRow.max_position + 1;

  db.prepare(
    `INSERT INTO document_groups (id, user_id, name, position, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin_only', ?, ?)`
  ).run(id, input.userId, input.name.trim(), position, now, now);

  return {
    id,
    userId: input.userId,
    name: input.name.trim(),
    position,
    visibility: "admin_only",
    createdAt: now,
    updatedAt: now,
  };
}

export function reorderDocumentGroups(
  userIdOrOrderedGroupIds: string | string[],
  orderedGroupIdsMaybe?: string[]
): DocumentGroup[] {
  const db = getDatabase();
  const now = new Date().toISOString();
  const userId = Array.isArray(userIdOrOrderedGroupIds)
    ? undefined
    : userIdOrOrderedGroupIds;
  const orderedGroupIds = Array.isArray(userIdOrOrderedGroupIds)
    ? userIdOrOrderedGroupIds
    : (orderedGroupIdsMaybe ?? []);
  const updateGroup = userId
    ? db.prepare(
        `UPDATE document_groups
         SET position = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
    : db.prepare(
        `UPDATE document_groups
         SET position = ?, updated_at = ?
         WHERE id = ?`
      );

  const transaction = db.transaction(() => {
    orderedGroupIds.forEach((groupId, index) => {
      if (userId) {
        updateGroup.run(index, now, groupId, userId);
      } else {
        updateGroup.run(index, now, groupId);
      }
    });
  });

  transaction();
  return listDocumentGroups(userId);
}

export function renameDocumentGroup(
  id: string,
  name: string
): DocumentGroup | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE document_groups SET name = ?, updated_at = ? WHERE id = ?`
    )
    .run(name.trim(), now, id);
  if (result.changes === 0) return null;
  return getDocumentGroupById(id);
}

export function deleteDocumentGroup(id: string): { success: boolean; bookCount?: number } {
  const db = getDatabase();
  // Refuse deletion if the group still has books
  const row = db.prepare("SELECT COUNT(*) AS count FROM documents WHERE group_id = ?").get(id) as { count: number };
  if (row.count > 0) {
    return { success: false, bookCount: row.count };
  }
  const result = db.prepare("DELETE FROM document_groups WHERE id = ?").run(id);
  return { success: result.changes > 0 };
}

export function setDocumentGroupVisibility(
  id: string,
  visibility: VisibilityType,
  userGroupIds: string[]
): DocumentGroup | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE document_groups SET visibility = ?, updated_at = ? WHERE id = ?`
    ).run(visibility, now, id);

    db.prepare(
      `DELETE FROM document_group_visibility WHERE document_group_id = ?`
    ).run(id);

    if (visibility === "user_groups" && userGroupIds.length > 0) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO document_group_visibility (document_group_id, user_group_id)
         VALUES (?, ?)`
      );
      for (const ugId of userGroupIds) {
        stmt.run(id, ugId);
      }
    }
  });

  transaction();
  return getDocumentGroupById(id);
}

export function getDocumentGroupUserGroupIds(groupId: string): string[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT user_group_id FROM document_group_visibility WHERE document_group_id = ?`
    )
    .all(groupId) as Array<{ user_group_id: string }>;
  return rows.map((r) => r.user_group_id);
}

/**
 * Returns a flat list of all groups with their associated user_group_ids.
 * Used for server-side permission filtering.
 */
export function listDocumentGroupsWithVisibility(): Array<
  DocumentGroup & { userGroupIds: string[] }
> {
  const db = getDatabase();
  const groups = listDocumentGroups();
  return groups.map((g) => ({
    ...g,
    userGroupIds: getDocumentGroupUserGroupIds(g.id),
  }));
}