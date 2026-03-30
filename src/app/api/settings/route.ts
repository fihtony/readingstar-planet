import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUserSettings,
  updateUserSettings,
} from "@/lib/repositories/settings-repository";

const DEFAULT_USER_ID = "default-user";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
  const settings = getOrCreateUserSettings(userId);
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId ?? DEFAULT_USER_ID;
    const settings = updateUserSettings(userId, body);
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json(
      { error: "Invalid settings payload" },
      { status: 400 }
    );
  }
}