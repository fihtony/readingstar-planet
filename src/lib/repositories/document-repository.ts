import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db";
import type { Document, FileType } from "@/types";

interface CreateDocumentInput {
  title: string;
  content: string;
  originalFilename: string;
  fileType: FileType;
  fileSize: number;
  uploadedBy: string;
}

interface DocumentRow {
  id: string;
  title: string;
  content: string;
  original_filename: string;
  file_type: FileType;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    originalFilename: row.original_filename,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDocument(input: CreateDocumentInput): Document {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO documents (id, title, content, original_filename, file_type, file_size, uploaded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.content,
    input.originalFilename,
    input.fileType,
    input.fileSize,
    input.uploadedBy,
    now,
    now
  );

  return {
    id,
    title: input.title,
    content: input.content,
    originalFilename: input.originalFilename,
    fileType: input.fileType,
    fileSize: input.fileSize,
    uploadedBy: input.uploadedBy,
    createdAt: now,
    updatedAt: now,
  };
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
        "SELECT * FROM documents WHERE uploaded_by = ? ORDER BY created_at DESC"
      )
      .all(uploadedBy) as DocumentRow[];
    return rows.map(rowToDocument);
  }
  const rows = db
    .prepare("SELECT * FROM documents ORDER BY created_at DESC")
    .all() as DocumentRow[];
  return rows.map(rowToDocument);
}

export function searchDocuments(query: string): Document[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT * FROM documents WHERE title LIKE ? ORDER BY created_at DESC"
    )
    .all(`%${query}%`) as DocumentRow[];
  return rows.map(rowToDocument);
}

export function deleteDocument(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  return result.changes > 0;
}
