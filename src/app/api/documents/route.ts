import { NextRequest, NextResponse } from "next/server";
import { createDocument, getDocumentById, listDocuments, searchDocuments, deleteDocument, moveDocumentToGroup, updateDocument, incrementDocumentReadCount } from "@/lib/repositories/document-repository";
import { ensureDefaultDocumentGroup, listDocumentGroups } from "@/lib/repositories/document-group-repository";
import { validateFile, extractTextFromPDF, extractTextFromTXT, titleFromFilename } from "@/lib/pdf-parser";
import { sanitizeTextContent } from "@/lib/text-processor";

const DEFAULT_USER_ID = "default-user";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const document = getDocumentById(id);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  }

  const search = request.nextUrl.searchParams.get("search");
  ensureDefaultDocumentGroup(DEFAULT_USER_ID);
  const documents = search ? searchDocuments(search) : listDocuments();
  const groups = listDocumentGroups(DEFAULT_USER_ID);
  return NextResponse.json({ documents, groups });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    // ── JSON body path: { title, content, groupId? } ──────────────────────
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const title = (body.title as string | undefined)?.trim();
      const content = body.content as string | undefined;
      const groupId = (body.groupId as string | null | undefined) ?? null;

      if (!title || !content?.trim()) {
        return NextResponse.json(
          { error: "title and content are required" },
          { status: 400 }
        );
      }

      const sanitized = sanitizeTextContent(content);
      const doc = createDocument({
        title,
        content: sanitized,
        originalFilename: `${title}.txt`,
        fileType: "txt",
        fileSize: Buffer.byteLength(sanitized, "utf8"),
        uploadedBy: DEFAULT_USER_ID,
        groupId,
      });

      return NextResponse.json({ document: doc }, { status: 201 });
    }

    // ── FormData path: file upload (supports optional titleOverride + groupId) ──
    const formData = await request.formData();
    const file = formData.get("file");
    const titleOverride = (formData.get("titleOverride") as string | null)?.trim() || null;
    const groupId = (formData.get("groupId") as string | null) || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate the file
    const validation = validateFile(file.name, file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Extract text based on file type
    let content: string;
    const arrayBuffer = await file.arrayBuffer();
    const fileType = validation.fileType!;

    if (fileType === "pdf") {
      content = await extractTextFromPDF(arrayBuffer);
    } else {
      content = extractTextFromTXT(arrayBuffer);
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: "The file appears to be empty or unreadable." },
        { status: 400 }
      );
    }

    content = sanitizeTextContent(content);
    const title = titleOverride ?? titleFromFilename(file.name);

    const doc = createDocument({
      title,
      content,
      originalFilename: file.name,
      fileType,
      fileSize: file.size,
      uploadedBy: DEFAULT_USER_ID,
      groupId,
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Something went wrong processing the file." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Document id is required" },
      { status: 400 }
    );
  }

  const success = deleteDocument(id);
  if (!success) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "move-document") {
      const documentId = body.documentId as string | undefined;
      const groupId = body.groupId as string | undefined;

      if (!documentId || !groupId) {
        return NextResponse.json(
          { error: "documentId and groupId are required" },
          { status: 400 }
        );
      }

      const document = moveDocumentToGroup(documentId, groupId);
      if (!document) {
        return NextResponse.json(
          { error: "Document or target group not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ document });
    }

    if (body.action === "update-document") {
      const documentId = body.documentId as string | undefined;
      const title = (body.title as string | undefined)?.trim();
      const content = body.content as string | undefined;
      const icon = body.icon !== undefined ? (body.icon as string | null) : undefined;

      if (!documentId || !title) {
        return NextResponse.json(
          { error: "documentId and title are required" },
          { status: 400 }
        );
      }

      const sanitized = content ? sanitizeTextContent(content) : undefined;
      const doc = updateDocument(documentId, { title, content: sanitized, icon });
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json({ document: doc });
    }

    if (body.action === "increment-read-count") {
      const documentId = body.documentId as string | undefined;

      if (!documentId) {
        return NextResponse.json(
          { error: "documentId is required" },
          { status: 400 }
        );
      }

      const document = incrementDocumentReadCount(documentId);
      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ document });
    }

    return NextResponse.json(
      { error: "Unsupported action" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
