import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sessions — Join a session (add current user as participant)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await request.json();

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  // Verify session exists and gate is open
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "gate_open") {
    return NextResponse.json({ error: "Gate is not open" }, { status: 400 });
  }

  // Add participant
  const { data, error } = await supabase
    .from("session_participants")
    .upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        status: "waiting",
      },
      { onConflict: "session_id,user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}
