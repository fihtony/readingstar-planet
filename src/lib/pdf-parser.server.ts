import "server-only";

import { join } from "path";
import { pathToFileURL } from "url";

const PDFJS_MODULE_URL = pathToFileURL(
  join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.mjs")
).href;
const PDFJS_WORKER_URL = pathToFileURL(
  join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;

export async function extractTextFromPDF(
  buffer: ArrayBuffer
): Promise<string> {
  const pdfjsLib = await import(/* webpackIgnore: true */ PDFJS_MODULE_URL);

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: string }) => item.str ?? "")
      .join(" ");

    if (pageText.trim()) {
      textParts.push(pageText.trim());
    }
  }

  return textParts.join("\n\n");
}