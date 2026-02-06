import { NextResponse } from "next/server";
import { closeGate } from "@/lib/gate-manager";

/**
 * POST /api/matching — Trigger matching for a session (admin/cron only)
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await request.json();

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await closeGate(sessionId);
    return NextResponse.json({
      success: true,
      groups: result.groups.length,
      lobbyUsers: result.lobbyUsers.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
