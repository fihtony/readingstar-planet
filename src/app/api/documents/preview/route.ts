import { NextRequest, NextResponse } from "next/server";
import { validateFile, titleFromFilename } from "@/lib/pdf-parser";
import { extractTextFromPDF } from "@/lib/pdf-parser.server";
import { sanitizeTextContent } from "@/lib/text-processor";
import { logger } from "@/lib/logger";
import { checkPermission } from "@/lib/permissions";

/**
 * POST /api/documents/preview
 *
 * Accepts a PDF file upload, extracts its text, and returns the content
 * WITHOUT saving to the database. Used by the frontend to show a preview
 * and allow editing before the user confirms the import.
 */
export async function POST(request: NextRequest) {
  const { authorized, response } = await checkPermission(request, "authenticated");
  if (!authorized) return response!;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validation = validateFile(file.name, file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (validation.fileType !== "pdf") {
      return NextResponse.json(
        { error: "Preview endpoint only supports PDF files" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const rawContent = await extractTextFromPDF(arrayBuffer);

    if (!rawContent.trim()) {
      return NextResponse.json(
        { error: "The PDF appears to be empty or unreadable." },
        { status: 400 }
      );
    }

    const content = sanitizeTextContent(rawContent);
    const title = titleFromFilename(file.name);

    return NextResponse.json({ content, title });
  } catch (error) {
    logger.error("pdf-preview", "PDF preview error", error);
    return NextResponse.json(
      { error: "Failed to extract text from the PDF." },
      { status: 500 }
    );
  }
}
