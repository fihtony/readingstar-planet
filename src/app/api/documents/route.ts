import { NextRequest, NextResponse } from "next/server";
import { createDocument, getDocumentById, listDocuments, searchDocuments, deleteDocument } from "@/lib/repositories/document-repository";
import { validateFile, extractTextFromPDF, extractTextFromTXT, titleFromFilename } from "@/lib/pdf-parser";
import { sanitizeTextContent } from "@/lib/text-processor";

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
  const documents = search ? searchDocuments(search) : listDocuments();
  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

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

    // Sanitize the extracted text
    content = sanitizeTextContent(content);

    // Build the document record
    const title = titleFromFilename(file.name);

    const doc = createDocument({
      title,
      content,
      originalFilename: file.name,
      fileType,
      fileSize: file.size,
      uploadedBy: "default-user",
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
