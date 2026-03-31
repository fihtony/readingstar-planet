import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import type { DocumentGroup } from "@/types";

const DEFAULT_DOCUMENT_GROUP_NAME = "My Books";

interface DocumentGroupRow {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToDocumentGroup(row: DocumentGroupRow): DocumentGroup {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    position: row.position,
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

export function listDocumentGroups(userId: string): DocumentGroup[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT *
       FROM document_groups
       WHERE user_id = ?
       ORDER BY position ASC, created_at ASC`
    )
    .all(userId) as DocumentGroupRow[];

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
    `INSERT INTO document_groups (id, user_id, name, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.userId, input.name.trim(), position, now, now);

  return {
    id,
    userId: input.userId,
    name: input.name.trim(),
    position,
    createdAt: now,
    updatedAt: now,
  };
}

export function reorderDocumentGroups(
  userId: string,
  orderedGroupIds: string[]
): DocumentGroup[] {
  const db = getDatabase();
  const now = new Date().toISOString();
  const updateGroup = db.prepare(
    `UPDATE document_groups
     SET position = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  );

  const transaction = db.transaction(() => {
    orderedGroupIds.forEach((groupId, index) => {
      updateGroup.run(index, now, groupId, userId);
    });
  });

  transaction();
  return listDocumentGroups(userId);
}