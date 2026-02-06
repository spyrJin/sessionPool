"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { VideoRoom } from "@/components/video-room";
import { MatchWaiting } from "@/components/match-waiting";
import { GateStatus } from "@/components/gate-status";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { session, group, partners, roomName, loading, error } =
    useSession(sessionId);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Session not found</p>
      </div>
    );
  }

  function handleLeave() {
    router.push("/");
  }

  // Calculate session end time
  const sessionStart = new Date(session.starts_at);
  const endsAt = new Date(
    sessionStart.getTime() +
      ((session.gate_duration_minutes ?? 5) + (session.duration_minutes ?? 30)) *
        60 *
        1000
  ).toISOString();

  // Session is active and user has a room — show video
  if (session.status === "active" && roomName) {
    return (
      <div className="flex h-screen flex-col bg-gray-950">
        <VideoRoom
          roomName={roomName}
          endsAt={endsAt}
          partners={partners}
          onLeave={handleLeave}
        />
      </div>
    );
  }

  // Waiting for matching
  if (session.status === "gate_open" || session.status === "matching") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">{session.name}</h1>
          <GateStatus status={session.status} />
        </div>
        <MatchWaiting />
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Session completed
  if (session.status === "completed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Session Complete</h1>
        <p className="text-gray-400">Great work! Your streak has been updated.</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Default: waiting state
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold">{session.name}</h1>
      <GateStatus status={session.status} />
      <p className="text-gray-400">Waiting for the session to start...</p>
      <button
        onClick={() => router.push("/")}
        className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
