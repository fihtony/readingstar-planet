import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import { getClientIp } from "@/lib/permissions";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

const NONCE_COOKIE = "rs_oauth_nonce";
const NONCE_MAX_AGE = 600; // 10 minutes

/** GET /api/auth/google — redirect to Google OAuth consent screen */
export async function GET() {
  const nonce = randomBytes(16).toString("hex");
  const authorizeUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    nonce,
  });
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must remain lax: callback is a cross-site redirect from Google
    path: "/",
    maxAge: NONCE_MAX_AGE,
  });
  return response;
}

