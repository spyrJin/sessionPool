/**
 * Streak Logic — ported from gas/UserManager.gs
 *
 * Streak rules:
 * - Participation on consecutive days → streak increments
 * - Miss a day → streak resets to 0
 * - First participation → streak = 1
 * - Multiple participations in one day → no extra increment
 */

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

/**
 * Record participation for a user (called after session completion).
 */
export async function recordParticipation(userId: string) {
  const supabase = getSupabaseAdmin();
  const today = toDateString(new Date());

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak, last_participation_date")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const lastDate = profile.last_participation_date;

  // Already recorded today
  if (lastDate === today) return;

  const yesterday = getYesterday();

  let newStreak: number;
  if (lastDate === yesterday) {
    // Consecutive — increment
    newStreak = (profile.streak ?? 0) + 1;
  } else {
    // Gap or first time — reset to 1
    newStreak = 1;
  }

  await supabase
    .from("profiles")
    .update({
      streak: newStreak,
      last_participation_date: today,
    })
    .eq("id", userId);
}

/**
 * Daily streak reset — reset streaks for users who didn't participate yesterday.
 * Run via cron at midnight.
 */
export async function dailyStreakReset() {
  const supabase = getSupabaseAdmin();
  const yesterday = getYesterday();

  // Reset streak for users whose last_participation_date is before yesterday
  // and who still have a streak > 0
  const { data, error } = await supabase
    .from("profiles")
    .update({ streak: 0 })
    .lt("last_participation_date", yesterday)
    .gt("streak", 0)
    .select("id");

  return { resetCount: data?.length ?? 0, error };
}

/**
 * Batch record participation for all users in a completed session.
 */
export async function recordSessionParticipation(sessionId: string) {
  const supabase = getSupabaseAdmin();

  const { data: participants } = await supabase
    .from("session_participants")
    .select("user_id")
    .eq("session_id", sessionId)
    .in("status", ["matched", "in_room", "completed"]);

  if (!participants) return;

  for (const p of participants) {
    await recordParticipation(p.user_id);
  }
}
