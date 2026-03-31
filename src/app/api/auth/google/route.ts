import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { getDatabase } from "@/lib/db";
import {
  getUserByGoogleId,
  getUserByEmail,
  createAuthSession,
  setSessionCookie,
  logUserActivity,
  checkLoginRateLimit,
  generateCsrfToken,
} from "@/lib/auth";
import { updateUser } from "@/lib/repositories/user-repository";
import { getClientIp } from "@/lib/permissions";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

/** GET /api/auth/google — redirect to Google OAuth consent screen */
export async function GET() {
  const authorizeUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
  return NextResponse.redirect(authorizeUrl);
}
