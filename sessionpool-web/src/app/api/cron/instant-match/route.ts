import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runMatching, type Participant } from "@/lib/matching-engine";
import { createRoom, generateToken } from "@/lib/livekit";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/cron/instant-match — Match users in the instant queue
 * Triggered by Vercel Cron every 60 seconds
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. Get all users in instant queue with their profiles
    const { data: queueEntries } = await supabase
      .from("instant_queue")
      .select("user_id, session_type, profiles(instagram_handle, streak)")
      .order("joined_at", { ascending: true });

    if (!queueEntries || queueEntries.length < 2) {
      return NextResponse.json({ success: true, matched: 0 });
    }

    // 2. Map to Participant type
    const participants: Participant[] = queueEntries.map((entry: any) => ({
      userId: entry.user_id,
      instagram: entry.profiles.instagram_handle,
      streak: entry.profiles.streak ?? 0,
      sessionType: entry.session_type ?? "instant",
    }));

    // 3. Run matching
    const result = runMatching(participants);

    if (result.groups.length === 0) {
      return NextResponse.json({ success: true, matched: 0 });
    }

    // 4. Create an instant session
    const { data: session } = await supabase
      .from("sessions")
      .insert({
        name: "Instant Match",
        session_type: "immerse",
        starts_at: new Date().toISOString(),
        duration_minutes: 30,
        gate_duration_minutes: 0,
        status: "active",
      })
      .select()
      .single();

    if (!session) {
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // 5. Create rooms for each group
    let matchedCount = 0;

    for (const group of result.groups) {
      const roomName = `instant-${session.id}-${crypto.randomUUID().slice(0, 8)}`;
      await createRoom(roomName, 30, group.members.length);

      const { data: groupRecord } = await supabase
        .from("groups")
        .insert({
          session_id: session.id,
          livekit_room_name: roomName,
          group_type: group.type,
          avg_streak: group.avgStreak,
        })
        .select()
        .single();

      if (!groupRecord) continue;

      for (const member of group.members) {
        // Add as group member
        await supabase.from("group_members").insert({
          group_id: groupRecord.id,
          user_id: member.userId,
        });

        // Add as session participant
        await supabase.from("session_participants").insert({
          session_id: session.id,
          user_id: member.userId,
          status: "matched",
        });

        // Remove from instant queue
        await supabase
          .from("instant_queue")
          .delete()
          .eq("user_id", member.userId);

        matchedCount++;
      }
    }

    return NextResponse.json({ success: true, matched: matchedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
