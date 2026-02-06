import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check if user has a profile (onboarding complete)
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/auth/login?onboarding=true");
  }

  // Fetch upcoming/active sessions
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .in("status", ["upcoming", "gate_open", "active"])
    .order("starts_at", { ascending: true });

  // Check if user is in instant queue
  const { data: queueEntry } = await supabase
    .from("instant_queue")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <Dashboard
      profile={profile}
      sessions={sessions ?? []}
      inQueue={!!queueEntry}
    />
  );
}
