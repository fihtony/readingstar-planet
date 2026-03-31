import { NextResponse } from "next/server";
import { getAuthContext, getDisplayName } from "@/lib/auth";
import type { PublicUser } from "@/types";

/** GET /api/auth/me — get current user info (or null for guest) */
export async function GET() {
  const { user } = await getAuthContext();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
  };

  return NextResponse.json({
    user: publicUser,
    displayName: getDisplayName(user),
  });
}
