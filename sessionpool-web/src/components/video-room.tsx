"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { SessionTimer } from "./session-timer";
import { UserBadge } from "./user-badge";

interface VideoRoomProps {
  roomName: string;
  /** Session end time as ISO string */
  endsAt: string;
  /** Partner info */
  partners: Array<{ instagram: string; streak: number }>;
  /** Called when session ends or user leaves */
  onLeave: () => void;
}

export function VideoRoom({
  roomName,
  endsAt,
  partners,
  onLeave,
}: VideoRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to get token");
        }

        const { token } = await res.json();
        setToken(token);
      } catch (err: any) {
        setError(err.message);
      }
    }

    fetchToken();
  }, [roomName]);

  const handleSessionComplete = useCallback(() => {
    onLeave();
  }, [onLeave]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-red-900/20 p-8">
        <p className="text-red-400">Failed to connect: {error}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: timer + partner info */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          {partners.map((p) => (
            <UserBadge
              key={p.instagram}
              instagram={p.instagram}
              streak={p.streak}
              size="sm"
            />
          ))}
        </div>
        <SessionTimer endsAt={endsAt} onComplete={handleSessionComplete} />
      </div>

      {/* Video area */}
      <div className="flex-1">
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          connect={true}
          onDisconnected={onLeave}
          data-lk-theme="default"
          style={{ height: "100%" }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}
