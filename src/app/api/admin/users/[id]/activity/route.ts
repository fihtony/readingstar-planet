import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/permissions";
import { getDatabase } from "@/lib/db";
import { getUserById } from "@/lib/auth";

/** GET /api/admin/users/[id]/activity — user activity summary for admin */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await checkPermission(request, "admin");
  if (!authorized) return response;

  const { id } = await params;

  const target = getUserById(id);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const db = getDatabase();

  // Recent activity log (last 30 entries)
  const activityLogs = db
    .prepare(
      `SELECT id, action, detail, ip_address, created_at
       FROM user_activity_log
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`
    )
    .all(id) as {
    id: string;
    action: string;
    detail: string;
    ip_address: string | null;
    created_at: string;
  }[];

  // Reading stats overview
  const statsRow = db
    .prepare(
      `SELECT
         COUNT(DISTINCT document_id) AS unique_docs,
         COALESCE(SUM(read_count), 0) AS total_reads,
         COALESCE(SUM(total_time_sec), 0) AS total_time_sec,
         MIN(first_read_at) AS first_read_at,
         MAX(last_read_at) AS last_read_at
       FROM user_reading_stats
       WHERE user_id = ?`
    )
    .get(id) as {
    unique_docs: number;
    total_reads: number;
    total_time_sec: number;
    first_read_at: string | null;
    last_read_at: string | null;
  };

  // Admin audit log (only for admin-role users, last 30 entries)
  let auditLogs: {
    id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    detail: string;
    created_at: string;
  }[] = [];

  if (target.role === "admin") {
    auditLogs = db
      .prepare(
        `SELECT id, action, target_type, target_id, detail, created_at
         FROM admin_audit_log
         WHERE admin_user_id = ?
         ORDER BY created_at DESC
         LIMIT 30`
      )
      .all(id) as typeof auditLogs;
  }

  return NextResponse.json({
    user: {
      id: target.id,
      email: target.email,
      nickname: target.nickname,
      name: target.name,
      role: target.role,
    },
    readingStats: {
      uniqueDocs: statsRow.unique_docs,
      totalReads: statsRow.total_reads,
      totalTimeSec: statsRow.total_time_sec,
      firstReadAt: statsRow.first_read_at,
      lastReadAt: statsRow.last_read_at,
    },
    activityLogs,
    auditLogs,
  });
}
