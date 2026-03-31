import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/permissions";
import { logUserActivity, getDisplayName } from "@/lib/auth";
import { updateUser } from "@/lib/repositories/user-repository";
import { getClientIp } from "@/lib/permissions";

const MAX_NOTE_LENGTH = 5000;
const HTTPS_URL_REGEX = /^https:\/\/.{1,2048}$/;

/** GET /api/account/profile — get current user's full profile */
export async function GET(request: NextRequest) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "authenticated"
  );
  if (!authorized) return response;

  const user = authContext.user!;

  return NextResponse.json({
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      avatarSource: user.avatarSource,
      personalNote: user.personalNote,
      role: user.role,
      displayName: getDisplayName(user),
    },
  });
}

/** PUT /api/account/profile — update nickname, avatar URL, personal note */
export async function PUT(request: NextRequest) {
  const { authorized, response, authContext } = await checkPermission(
    request,
    "authenticated"
  );
  if (!authorized) return response;

  const user = authContext.user!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Parameters<typeof updateUser>[1] = {};

  // Nickname
  if (body.nickname !== undefined) {
    const nickname = String(body.nickname).trim();
    if (nickname.length > 100) {
      return NextResponse.json(
        { error: "Nickname must be 100 characters or fewer" },
        { status: 400 }
      );
    }
    updates.nickname = nickname;
  }

  // Avatar URL
  if (body.avatarUrl !== undefined) {
    const avatarUrl = String(body.avatarUrl).trim();
    if (avatarUrl && !HTTPS_URL_REGEX.test(avatarUrl)) {
      return NextResponse.json(
        { error: "Avatar URL must be a valid HTTPS URL (max 2048 chars)" },
        { status: 400 }
      );
    }
    updates.avatarUrl = avatarUrl;
    updates.avatarSource = avatarUrl ? "custom" : "google";
  }

  // Personal note
  if (body.personalNote !== undefined) {
    const note = String(body.personalNote);
    if (note.length > MAX_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Personal note must be ${MAX_NOTE_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }
    updates.personalNote = note;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = updateUser(user.id, updates);

  logUserActivity(
    user.id,
    "profile_updated",
    JSON.stringify(Object.keys(updates)),
    getClientIp(request)
  );

  return NextResponse.json({
    profile: {
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      nickname: updated!.nickname,
      avatarUrl: updated!.avatarUrl,
      avatarSource: updated!.avatarSource,
      personalNote: updated!.personalNote,
      role: updated!.role,
      displayName: getDisplayName(updated!),
    },
  });
}
