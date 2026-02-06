"use client";

import { GateStatus } from "./gate-status";

interface Session {
  id: string;
  name: string;
  session_type: string;
  starts_at: string;
  duration_minutes: number;
  status: "upcoming" | "gate_open" | "matching" | "active" | "completed";
}

interface SessionCardProps {
  session: Session;
  onJoin: (sessionId: string) => void;
  isJoined?: boolean;
  loading?: boolean;
}

export function SessionCard({
  session,
  onJoin,
  isJoined,
  loading,
}: SessionCardProps) {
  const startTime = new Date(session.starts_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const typeColors = {
    immerse: "border-blue-800/50 bg-blue-950/30",
    recover: "border-green-800/50 bg-green-950/30",
  };

  const bgColor =
    typeColors[session.session_type as keyof typeof typeColors] ??
    "border-gray-800 bg-gray-900";

  return (
    <div className={`rounded-xl border p-4 ${bgColor}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-white">{session.name}</h3>
          <p className="mt-0.5 text-sm text-gray-400">
            {startTime} · {session.duration_minutes}min ·{" "}
            {session.session_type}
          </p>
        </div>
        <GateStatus status={session.status} startsAt={session.starts_at} />
      </div>

      <div className="mt-3">
        {session.status === "gate_open" && !isJoined && (
          <button
            onClick={() => onJoin(session.id)}
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join Session"}
          </button>
        )}
        {isJoined && session.status === "gate_open" && (
          <div className="rounded-lg bg-green-900/30 px-4 py-2 text-center text-sm text-green-400">
            Joined — waiting for gate to close...
          </div>
        )}
        {session.status === "upcoming" && (
          <p className="text-center text-sm text-gray-500">
            Gate opens at {startTime}
          </p>
        )}
        {session.status === "active" && (
          <p className="text-center text-sm text-blue-400">Session in progress</p>
        )}
      </div>
    </div>
  );
}
