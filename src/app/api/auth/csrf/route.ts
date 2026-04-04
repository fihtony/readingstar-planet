import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/auth";

/** GET /api/auth/csrf — get a fresh CSRF token returned in the JSON body */
export async function GET() {
  const token = await generateCsrfToken();
  return NextResponse.json({ csrfToken: token });
}
