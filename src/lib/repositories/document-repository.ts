import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import type { Document, FileType, VisibilityType } from "@/types";
import {
  ensureDefaultDocumentGroup,
  getDocumentGroupById,
  getDocumentGroupUserGroupIds,
} from "./document-group-repository";

interface CreateDocumentInput {
  title: string;
  content: string;
  originalFilename: string;
  fileType: FileType;
  fileSize: number;
  uploadedBy: string;
  groupId?: string | null;
  icon?: string | null;
}

interface DocumentRow {
  id: string;
  title: string;
  content: string;
  original_filename: string;
  file_type: FileType;
  file_size: number;
  read_count: number;
  uploaded_by: string;
  group_id: string | null;
  group_position: number;
  icon: string | null;
  access_override: number;
  visibility: string;
  created_at: string;
  updated_at: string;
}

export type MoveDocumentVisibilityChoice = "inherit_target" | "preserve_current";

interface VisibilitySnapshot {
  visibility: VisibilityType;
  userGroupIds: string[];
}

interface MoveDocumentConfirmation {
  documentTitle: string;
  sourceGroupName: string | null;
  targetGroupName: string | null;
  currentVisibility: VisibilitySnapshot;
  targetVisibility: VisibilitySnapshot;
}

export type MoveDocumentWithVisibilityResult =
  | {
      status: "moved";
      document: Document;
    }
  | {
      status: "confirmation_required";
      confirmation: MoveDocumentConfirmation;
    }
  | {
      status: "not_found";
      reason: "document" | "group";
    };

function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    originalFilename: row.original_filename,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    groupId: row.group_id,
    groupPosition: row.group_position,
    icon: row.icon,
    accessOverride: row.access_override === 1,
    visibility: (row.visibility ?? "public") as VisibilityType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readCount: row.read_count,
  };
}

function getNextGroupPosition(groupId: string | null): number {
  const db = getDatabase();

  if (groupId === null) {
    const row = db.prepare(
      `SELECT COALESCE(MAX(group_position), -1) AS max_position
       FROM documents
       WHERE group_id IS NULL`
    ).get() as { max_position: number };

    return row.max_position + 1;
  }

  const row = db.prepare(
    `SELECT COALESCE(MAX(group_position), -1) AS max_position
     FROM documents
     WHERE group_id = ?`
  ).get(groupId) as { max_position: number };

  return row.max_position + 1;
}

function normalizeUserGroupIds(userGroupIds: string[]): string[] {
  return Array.from(new Set(userGroupIds)).sort();
}

function visibilitySnapshotsEqual(
  left: VisibilitySnapshot,
  right: VisibilitySnapshot
): boolean {
  return (
    left.visibility === right.visibility
    && JSON.stringify(normalizeUserGroupIds(left.userGroupIds))
      === JSON.stringify(normalizeUserGroupIds(right.userGroupIds))
  );
}

function getEffectiveDocumentVisibility(document: Document): VisibilitySnapshot {
  if (document.accessOverride) {
    return {
      visibility: document.visibility ?? "admin_only",
      userGroupIds: getDocumentUserGroupIds(document.id),
    };
  }

  if (!document.groupId) {
    return {
      visibility: "admin_only",
      userGroupIds: [],
    };
  }

  const group = getDocumentGroupById(document.groupId);
  return {
    visibility: group?.visibility ?? "admin_only",
    userGroupIds: group ? getDocumentGroupUserGroupIds(group.id) : [],
  };
}

function applyDocumentPlacement(
  documentId: string,
  groupId: string | null,
  accessOverride: boolean,
  visibility: VisibilityType,
  userGroupIds: string[]
): Document | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const nextGroupPosition = getNextGroupPosition(groupId);

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE documents
       SET group_id = ?, group_position = ?, access_override = ?, visibility = ?, updated_at = ?
       WHERE id = ?`
    ).run(groupId, nextGroupPosition, accessOverride ? 1 : 0, visibility, now, documentId);

    db.prepare(
      `DELETE FROM document_visibility WHERE document_id = ?`
    ).run(documentId);

    if (accessOverride && visibility === "user_groups") {
      const insertVisibility = db.prepare(
        `INSERT OR IGNORE INTO document_visibility (document_id, user_group_id)
         VALUES (?, ?)`
      );

      for (const userGroupId of normalizeUserGroupIds(userGroupIds)) {
        insertVisibility.run(documentId, userGroupId);
      }
    }
  });

  transaction();
  return getDocumentById(documentId);
}

export function createDocument(input: CreateDocumentInput): Document {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const targetGroup = input.groupId === null
    ? null
    : input.groupId
      ? (getDocumentGroupById(input.groupId) ?? ensureDefaultDocumentGroup(input.uploadedBy))
      : ensureDefaultDocumentGroup(input.uploadedBy);
  const targetGroupId = targetGroup?.id ?? null;
  const accessOverride = targetGroupId === null;
  const visibility = accessOverride
    ? "admin_only"
    : (targetGroup?.visibility ?? "public");
  const groupPosition = getNextGroupPosition(targetGroupId);

  db.prepare(
    `INSERT INTO documents (
      id,
      title,
      content,
      original_filename,
      file_type,
      file_size,
      read_count,
      uploaded_by,
      group_id,
      group_position,
      icon,
      access_override,
      visibility,
      created_at,
      updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.content,
    input.originalFilename,
    input.fileType,
    input.fileSize,
    0,
    input.uploadedBy,
    targetGroupId,
    groupPosition,
    input.icon ?? null,
    accessOverride ? 1 : 0,
    visibility,
    now,
    now
  );

  return getDocumentById(id)!;
}

export function getDocumentById(id: string): Document | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(id) as DocumentRow | undefined;
  return row ? rowToDocument(row) : null;
}

export function listDocuments(uploadedBy?: string): Document[] {
  const db = getDatabase();
  if (uploadedBy) {
    const rows = db
      .prepare(
        "SELECT * FROM documents WHERE uploaded_by = ? ORDER BY group_position ASC, created_at DESC"
      )
      .all(uploadedBy) as DocumentRow[];
    return rows.map(rowToDocument);
  }
  const rows = db
    .prepare("SELECT * FROM documents ORDER BY group_position ASC, created_at DESC")
    .all() as DocumentRow[];
  return rows.map(rowToDocument);
}

export function searchDocuments(query: string): Document[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT * FROM documents WHERE title LIKE ? ORDER BY group_position ASC, created_at DESC"
    )
    .all(`%${query}%`) as DocumentRow[];
  return rows.map(rowToDocument);
}

export function updateDocument(
  id: string,
  input: { title?: string; content?: string; icon?: string | null }
): Document | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    sets.push("title = ?");
    values.push(input.title);
  }
  if (input.content !== undefined) {
    sets.push("content = ?");
    values.push(input.content);
    sets.push("file_size = ?");
    values.push(Buffer.byteLength(input.content, "utf8"));
  }
  if (input.icon !== undefined) {
    sets.push("icon = ?");
    values.push(input.icon);
  }

  if (sets.length > 0) {
    sets.push("updated_at = ?");
    values.push(now);
    values.push(id);
    db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  return getDocumentById(id);
}

export function moveDocumentToGroup(
  documentId: string,
  groupId: string
): Document | null {
  const db = getDatabase();
  const targetGroup = getDocumentGroupById(groupId);

  if (!targetGroup) {
    return null;
  }

  const doc = getDocumentById(documentId);
  if (!doc) {
    return null;
  }

  const nextPositionRow = db.prepare(
    `SELECT COALESCE(MAX(group_position), -1) AS max_position
     FROM documents
     WHERE group_id = ?`
  ).get(groupId) as { max_position: number };

  db.prepare(
    `UPDATE documents
     SET group_id = ?, group_position = ?, updated_at = ?
     WHERE id = ?`
  ).run(groupId, nextPositionRow.max_position + 1, new Date().toISOString(), documentId);

  return getDocumentById(documentId);
}

export function moveDocumentWithVisibilityHandling(
  documentId: string,
  targetGroupId: string | null,
  choice?: MoveDocumentVisibilityChoice
): MoveDocumentWithVisibilityResult {
  const document = getDocumentById(documentId);
  if (!document) {
    return { status: "not_found", reason: "document" };
  }

  if (document.groupId === targetGroupId) {
    return { status: "moved", document };
  }

  const sourceGroup = document.groupId ? getDocumentGroupById(document.groupId) : null;
  const currentVisibility = getEffectiveDocumentVisibility(document);

  if (targetGroupId === null) {
    const moved = applyDocumentPlacement(
      documentId,
      null,
      true,
      currentVisibility.visibility,
      currentVisibility.userGroupIds
    );

    return moved
      ? { status: "moved", document: moved }
      : { status: "not_found", reason: "document" };
  }

  const targetGroup = getDocumentGroupById(targetGroupId);
  if (!targetGroup) {
    return { status: "not_found", reason: "group" };
  }

  const targetVisibility: VisibilitySnapshot = {
    visibility: targetGroup.visibility ?? "public",
    userGroupIds: getDocumentGroupUserGroupIds(targetGroup.id),
  };

  if (!choice && !visibilitySnapshotsEqual(currentVisibility, targetVisibility)) {
    return {
      status: "confirmation_required",
      confirmation: {
        documentTitle: document.title,
        sourceGroupName: sourceGroup?.name ?? null,
        targetGroupName: targetGroup.name,
        currentVisibility,
        targetVisibility,
      },
    };
  }

  const shouldPreserveCurrent = choice === "preserve_current";
  const moved = applyDocumentPlacement(
    documentId,
    targetGroupId,
    shouldPreserveCurrent,
    shouldPreserveCurrent ? currentVisibility.visibility : targetVisibility.visibility,
    shouldPreserveCurrent ? currentVisibility.userGroupIds : targetVisibility.userGroupIds
  );

  return moved
    ? { status: "moved", document: moved }
    : { status: "not_found", reason: "document" };
}

export function deleteDocument(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  return result.changes > 0;
}

export function incrementDocumentReadCount(id: string): Document | null {
  const db = getDatabase();
  const result = db.prepare(
    `UPDATE documents
     SET read_count = read_count + 1
     WHERE id = ?`
  ).run(id);

  if (result.changes === 0) {
    return null;
  }

  return getDocumentById(id);
}

export function setDocumentVisibility(
  id: string,
  accessOverride: boolean,
  visibility: VisibilityType,
  userGroupIds: string[]
): Document | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE documents SET access_override = ?, visibility = ?, updated_at = ? WHERE id = ?`
    ).run(accessOverride ? 1 : 0, visibility, now, id);

    db.prepare(
      `DELETE FROM document_visibility WHERE document_id = ?`
    ).run(id);

    if (accessOverride && visibility === "user_groups" && userGroupIds.length > 0) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO document_visibility (document_id, user_group_id) VALUES (?, ?)`
      );
      for (const ugId of userGroupIds) {
        stmt.run(id, ugId);
      }
    }
  });

  transaction();
  return getDocumentById(id);
}

export function getDocumentUserGroupIds(documentId: string): string[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT user_group_id FROM document_visibility WHERE document_id = ?`
    )
    .all(documentId) as Array<{ user_group_id: string }>;
  return rows.map((r) => r.user_group_id);
}
