import { NextResponse } from "next/server";
import { closeDueGates, completeExpiredSessions } from "@/lib/gate-manager";
import { recordSessionParticipation } from "@/lib/streak";

/**
 * GET /api/cron/gate-close — Close gates and trigger matching
 * Triggered by Vercel Cron every 30 minutes at :05 and :35
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Close due gates (triggers matching)
    const closed = await closeDueGates();

    // 2. Complete expired sessions and record streaks
    const completed = await completeExpiredSessions();

    for (const sessionId of completed) {
      await recordSessionParticipation(sessionId);
    }

    return NextResponse.json({ success: true, closed, completed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
