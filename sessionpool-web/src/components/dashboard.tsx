"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { SessionCard } from "./session-card";
import { UserBadge } from "./user-badge";
import { MatchWaiting } from "./match-waiting";
import { useGateStatus } from "@/hooks/use-gate-status";
import { useMatching } from "@/hooks/use-matching";

interface Profile {
  id: string;
  instagram_handle: string;
  streak: number;
}

interface Session {
  id: string;
  name: string;
  session_type: string;
  starts_at: string;
  duration_minutes: number;
  status: "upcoming" | "gate_open" | "matching" | "active" | "completed";
}

interface DashboardProps {
  profile: Profile;
  sessions: Session[];
  inQueue: boolean;
}

export function Dashboard({
  profile,
  sessions: initialSessions,
  inQueue: initialInQueue,
}: DashboardProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [joinedSessions, setJoinedSessions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(initialInQueue);
  const [queueLoading, setQueueLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Subscribe to realtime gate status changes
  useGateStatus((updatedSession) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === updatedSession.id ? { ...s, ...updatedSession } : s
      )
    );
  });

  // Subscribe to match notifications for this user
  useMatching(profile.id, (matchData) => {
    // Redirect to session page when matched
    router.push(`/session/${matchData.sessionId}`);
  });

  async function handleJoin(sessionId: string) {
    setLoading(sessionId);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        setJoinedSessions((prev) => new Set([...prev, sessionId]));
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleInstantMatch() {
    setQueueLoading(true);
    try {
      if (inQueue) {
        await fetch("/api/queue", { method: "DELETE" });
        setInQueue(false);
      } else {
        await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionType: "immerse" }),
        });
        setInQueue(true);
      }
    } finally {
      setQueueLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const hasJoinedAny = joinedSessions.size > 0 || inQueue;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SessionPool</h1>
          <p className="text-sm text-gray-400">Focus together</p>
        </div>
        <div className="flex items-center gap-3">
          <UserBadge
            instagram={profile.instagram_handle}
            streak={profile.streak}
          />
          <button
            onClick={handleSignOut}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Waiting indicator */}
      {hasJoinedAny && (
        <div className="mt-6">
          <MatchWaiting />
        </div>
      )}

      {/* Instant match */}
      <div className="mt-8">
        <button
          onClick={handleInstantMatch}
          disabled={queueLoading}
          className={`w-full rounded-xl py-4 text-lg font-semibold transition ${
            inQueue
              ? "bg-orange-600 text-white hover:bg-orange-700"
              : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
          } disabled:opacity-50`}
        >
          {queueLoading
            ? "..."
            : inQueue
              ? "Leave Queue"
              : "Match Me Now"}
        </button>
        {inQueue && (
          <p className="mt-2 text-center text-sm text-orange-400">
            You&apos;re in the queue. We&apos;ll match you in the next cycle.
          </p>
        )}
      </div>

      {/* Sessions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-300">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-center text-gray-500">
            No sessions scheduled. Use &quot;Match Me Now&quot; to find a partner.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onJoin={handleJoin}
                isJoined={joinedSessions.has(session.id)}
                loading={loading === session.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
