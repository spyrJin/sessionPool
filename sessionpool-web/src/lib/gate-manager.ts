/**
 * Gate Manager — ported from gas/GateManager.gs
 *
 * Adapted for Supabase + LiveKit (no Google Sheets dependency).
 *
 * Gate lifecycle:
 * 1. openGate(sessionId) → set status to 'gate_open'
 * 2. closeGate(sessionId) → collect participants, run matching, create rooms
 */

import { createClient } from "@supabase/supabase-js";
import { runMatching, type Participant } from "./matching-engine";
import { createRoom, generateToken } from "./livekit";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Open the gate for a session — allows users to join.
 */
export async function openGate(sessionId: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("sessions")
    .update({ status: "gate_open" })
    .eq("id", sessionId)
    .eq("status", "upcoming");

  if (error) throw error;
}

/**
 * Close the gate — collect participants, run matching, create LiveKit rooms.
 */
export async function closeGate(sessionId: string) {
  const supabase = getSupabaseAdmin();

  // 1. Update session status to 'matching'
  await supabase
    .from("sessions")
    .update({ status: "matching" })
    .eq("id", sessionId);

  // 2. Get session info
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error(`Session ${sessionId} not found`);

  // 3. Collect waiting participants with their profiles
  const { data: participantRows } = await supabase
    .from("session_participants")
    .select("user_id, profiles(instagram_handle, streak)")
    .eq("session_id", sessionId)
    .eq("status", "waiting");

  if (!participantRows || participantRows.length === 0) {
    await supabase
      .from("sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);
    return { groups: [], lobbyUsers: [] };
  }

  // 4. Map to Participant type
  const participants: Participant[] = participantRows.map((row: any) => ({
    userId: row.user_id,
    instagram: row.profiles.instagram_handle,
    streak: row.profiles.streak ?? 0,
    sessionType: session.session_type,
  }));

  // 5. Run matching engine
  const matchResult = runMatching(participants);

  // 6. Create LiveKit rooms and DB group records
  for (const group of matchResult.groups) {
    const roomName = `session-${sessionId}-${crypto.randomUUID().slice(0, 8)}`;

    // Create LiveKit room
    await createRoom(roomName, session.duration_minutes, group.members.length);

    // Insert group record
    const { data: groupRecord } = await supabase
      .from("groups")
      .insert({
        session_id: sessionId,
        livekit_room_name: roomName,
        group_type: group.type,
        avg_streak: group.avgStreak,
      })
      .select()
      .single();

    if (!groupRecord) continue;

    // Insert group members
    const memberInserts = group.members.map((m) => ({
      group_id: groupRecord.id,
      user_id: m.userId,
    }));

    await supabase.from("group_members").insert(memberInserts);

    // Update participant status to 'matched'
    for (const member of group.members) {
      await supabase
        .from("session_participants")
        .update({ status: "matched" })
        .eq("session_id", sessionId)
        .eq("user_id", member.userId);
    }
  }

  // 7. Handle lobby users
  for (const lobbyUser of matchResult.lobbyUsers) {
    const roomName = `lobby-${sessionId}-${crypto.randomUUID().slice(0, 8)}`;

    await createRoom(roomName, session.duration_minutes, 3);

    const { data: groupRecord } = await supabase
      .from("groups")
      .insert({
        session_id: sessionId,
        livekit_room_name: roomName,
        group_type: "lobby",
        avg_streak: lobbyUser.streak,
      })
      .select()
      .single();

    if (groupRecord) {
      await supabase.from("group_members").insert({
        group_id: groupRecord.id,
        user_id: lobbyUser.userId,
      });
    }
  }

  // 8. Update session status to 'active'
  await supabase
    .from("sessions")
    .update({ status: "active" })
    .eq("id", sessionId);

  return matchResult;
}

/**
 * Open gates for all sessions that should be open now.
 */
export async function openDueGates() {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  // Find sessions where starts_at is within the next 30 minutes and status is 'upcoming'
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, starts_at, gate_duration_minutes")
    .eq("status", "upcoming")
    .lte("starts_at", now.toISOString());

  if (!sessions) return [];

  const opened: string[] = [];
  for (const session of sessions) {
    await openGate(session.id);
    opened.push(session.id);
  }

  return opened;
}

/**
 * Close gates for sessions whose gate window has elapsed.
 */
export async function closeDueGates() {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, starts_at, gate_duration_minutes")
    .eq("status", "gate_open");

  if (!sessions) return [];

  const closed: string[] = [];
  for (const session of sessions) {
    const gateEnd = new Date(session.starts_at);
    gateEnd.setMinutes(
      gateEnd.getMinutes() + (session.gate_duration_minutes ?? 5)
    );

    if (now >= gateEnd) {
      await closeGate(session.id);
      closed.push(session.id);
    }
  }

  return closed;
}

/**
 * Complete sessions that have passed their duration.
 */
export async function completeExpiredSessions() {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, starts_at, duration_minutes, gate_duration_minutes")
    .eq("status", "active");

  if (!sessions) return [];

  const completed: string[] = [];
  for (const session of sessions) {
    const sessionEnd = new Date(session.starts_at);
    sessionEnd.setMinutes(
      sessionEnd.getMinutes() +
        (session.gate_duration_minutes ?? 5) +
        (session.duration_minutes ?? 30)
    );

    if (now >= sessionEnd) {
      // Mark session completed
      await supabase
        .from("sessions")
        .update({ status: "completed" })
        .eq("id", session.id);

      // Mark all participants completed
      await supabase
        .from("session_participants")
        .update({ status: "completed" })
        .eq("session_id", session.id);

      completed.push(session.id);
    }
  }

  return completed;
}
