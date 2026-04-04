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
} from "@/lib/auth";
import { createUser, updateUser } from "@/lib/repositories/user-repository";
import { getClientIp, getLocationFromRequest } from "@/lib/permissions";
import { getAppUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

/** GET /api/auth/google/callback — handle Google OAuth callback */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const location = getLocationFromRequest(request);
  const userAgent = request.headers.get("user-agent") ?? "";

  // Rate limit
  if (ip && !checkLoginRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a moment." },
      { status: 429 }
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(getAppUrl(request, "/library"));
  }

  // Nonce is required to prevent ID token replay attacks.
  // If the cookie is absent the flow must be restarted.
  const nonce = request.cookies.get("rs_oauth_nonce")?.value;
  if (!nonce) {
    return NextResponse.redirect(getAppUrl(request, "/library?error=auth_failed"));
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: GOOGLE_CLIENT_ID,
      // Nonce is guaranteed non-null here (validated above).
      // Spread form used because the type definition does not include `nonce`.
      ...(nonce ? { nonce } : {}),
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return NextResponse.redirect(getAppUrl(request, "/library?error=auth_failed"));
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? "";
    const picture = payload.picture ?? "";

    const db = getDatabase();

    // Check registration policy
    const policyRow = db.prepare(
      "SELECT value FROM app_metadata WHERE key = 'registration_policy'"
    ).get() as { value: string } | undefined;
    const policy = policyRow?.value ?? "invite-only";

    // Try to find existing user by google_id first, then by email
    let user = getUserByGoogleId(googleId) ?? getUserByEmail(email);

    if (!user) {
      // New user
      if (policy === "invite-only") {
        return NextResponse.redirect(
          getAppUrl(request, "/library?error=invite_only")
        );
      }

      // Open registration: auto-create
      user = createUser({
        email,
        googleId,
        name,
        nickname: name,
        avatarUrl: picture,
        role: "user",
        status: "active",
      });
    } else {
      // Existing user – check status
      if (user.status === "deleted") {
        // Treat deleted accounts the same as unknown users in invite-only mode:
        // do not reveal that the account previously existed.
        return NextResponse.redirect(
          getAppUrl(request, "/library?error=invite_only")
        );
      }
      if (user.status === "inactive") {
        return NextResponse.redirect(
          getAppUrl(request, "/library?error=invite_only")
        );
      }

      // Complete pending_verification activation
      if (user.status === "pending_verification") {
        updateUser(user.id, {
          googleId,
          name,
          nickname: name || user.nickname,
          avatarUrl: picture,
          status: "active",
          lastLoginAt: new Date().toISOString(),
        });
        user = { ...user, status: "active", googleId, name, avatarUrl: picture };
      } else {
        // Active user – update avatar if source is google, update name/last_login
        const updates: Parameters<typeof updateUser>[1] = {
          lastLoginAt: new Date().toISOString(),
        };
        if (!user.googleId) {
          updates.googleId = googleId;
        }
        if (user.avatarSource === "google" && picture) {
          updates.avatarUrl = picture;
        }
        if (name && !user.name) {
          updates.name = name;
        }
        updateUser(user.id, updates);
      }
    }

    // Create session (no IP stored for privacy compliance)
    const session = createAuthSession(user.id, null, userAgent);
    await setSessionCookie(session.id);

    // Log login (location from CDN geo headers; raw IP not recorded)
    logUserActivity(user.id, "login", JSON.stringify({
      userAgent: userAgent.substring(0, 200),
    }), location);

    // Update last_login_at
    updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    const redirectResponse = NextResponse.redirect(getAppUrl(request, "/library"));
    // Clear the one-time nonce cookie
    redirectResponse.cookies.delete("rs_oauth_nonce");
    return redirectResponse;
  } catch (error) {
    logger.error("oauth-callback", "OAuth callback error", error);
    return NextResponse.redirect(
      getAppUrl(request, "/library?error=auth_failed")
    );
  }
}
