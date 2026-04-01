import { NextRequest, NextResponse } from "next/server";
import { createDocument, getDocumentById, listDocuments, searchDocuments, deleteDocument, moveDocumentToGroup, updateDocument, incrementDocumentReadCount } from "@/lib/repositories/document-repository";
import { ensureDefaultDocumentGroup, listDocumentGroups } from "@/lib/repositories/document-group-repository";
import { validateFile, extractTextFromTXT, titleFromFilename } from "@/lib/pdf-parser";
import { extractTextFromPDF } from "@/lib/pdf-parser.server";
import { sanitizeTextContent } from "@/lib/text-processor";
import { checkPermission, getClientIp } from "@/lib/permissions";
import { getAuthContext, logAdminAudit, logUserActivity } from "@/lib/auth";
import { recordUserRead, getUserStatsMap } from "@/lib/repositories/reading-stats-repository";

export async function GET(request: NextRequest) {
  const { authContext } = await checkPermission(request, "public");
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const document = getDocumentById(id);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  }

  const sort = request.nextUrl.searchParams.get("sort");

  // my-read sort requires authentication
  if (sort === "my-read") {
    if (!authContext.user) {
      return NextResponse.json(
        { error: "Authentication required for personal sort" },
        { status: 401 }
      );
    }
  }

  const search = request.nextUrl.searchParams.get("search");
  const documents = search ? searchDocuments(search) : listDocuments();
  const groups = listDocumentGroups();

  // Attach user reading stats if authenticated
  let userStats: Record<string, { readCount: number; avgTimeSec: number | null }> | undefined;
  if (authContext.user) {
    const statsMap = getUserStatsMap(authContext.user.id);
    userStats = {};
    for (const [docId, stat] of statsMap) {
      userStats[docId] = {
        readCount: stat.readCount,
        avgTimeSec: stat.timedSessionCount > 0
          ? Math.round(stat.totalTimeSec / stat.timedSessionCount)
          : null,
      };
    }
  }

  return NextResponse.json({ documents, groups, userStats });
}

export async function POST(request: NextRequest) {
  // Admin only
  const { authorized, response: permResponse, authContext: postAuth } = await checkPermission(request, "admin");
  if (!authorized) return permResponse;

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
        uploadedBy: postAuth.user!.id,
        groupId,
      });

      logAdminAudit(
        postAuth.user!.id,
        "document_uploaded",
        "document",
        doc.id,
        JSON.stringify({ title: doc.title, method: "json" })
      );

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
      uploadedBy: postAuth.user!.id,
      groupId,
    });

    logAdminAudit(
      postAuth.user!.id,
      "document_uploaded",
      "document",
      doc.id,
      JSON.stringify({ title: doc.title, filename: file.name, method: "file" })
    );

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
  const { authorized, response: permResponse, authContext: delAuth } = await checkPermission(request, "admin");
  if (!authorized) return permResponse;

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Document id is required" },
      { status: 400 }
    );
  }

  const doc = getDocumentById(id);
  if (!doc) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  const success = deleteDocument(id);
  if (!success) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  logAdminAudit(
    delAuth.user!.id,
    "document_deleted",
    "document",
    id,
    JSON.stringify({ title: doc.title })
  );

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "increment-read-count") {
      // increment-read-count is public (anyone can read)
      const { authContext: readAuth } = await checkPermission(request, "public");
      const documentId = body.documentId as string | undefined;

      if (!documentId) {
        return NextResponse.json(
          { error: "documentId is required" },
          { status: 400 }
        );
      }

      // If authenticated, record per-user stats and the global count is also incremented
      if (readAuth.user) {
        const stats = recordUserRead(readAuth.user.id, documentId);
        const document = getDocumentById(documentId);
        if (!document) {
          return NextResponse.json(
            { error: "Document not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({ document, userStats: stats });
      }

      // Guest: only increment global count
      const document = incrementDocumentReadCount(documentId);
      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ document });
    }

    // All other PATCH actions require admin
    const { authorized, response: permResponse, authContext: patchAuth } = await checkPermission(request, "admin");
    if (!authorized) return permResponse;

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

      logAdminAudit(
        patchAuth.user!.id,
        "document_edited",
        "document",
        documentId,
        JSON.stringify({ action: "move-document", groupId })
      );

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

      logAdminAudit(
        patchAuth.user!.id,
        "document_edited",
        "document",
        documentId,
        JSON.stringify({ action: "update-document", title })
      );

      return NextResponse.json({ document: doc });
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
