import { NextResponse } from "next/server";
import { openDueGates } from "@/lib/gate-manager";

/**
 * GET /api/cron/gate-open — Open gates for sessions that are due
 * Triggered by Vercel Cron every 30 minutes at :00 and :30
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const opened = await openDueGates();
    return NextResponse.json({ success: true, opened });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
