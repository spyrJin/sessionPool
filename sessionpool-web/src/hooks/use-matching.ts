"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface MatchData {
  sessionId: string;
  groupId: string;
  roomName: string;
}

/**
 * Subscribe to match notifications for a specific user.
 * Fires when the user is added to a group_members record.
 */
export function useMatching(
  userId: string,
  onMatch: (data: MatchData) => void
) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`match:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_members",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Fetch the group details to get room name and session id
          const { data: group } = await supabase
            .from("groups")
            .select("id, session_id, livekit_room_name")
            .eq("id", payload.new.group_id)
            .single();

          if (group) {
            onMatch({
              sessionId: group.session_id,
              groupId: group.id,
              roomName: group.livekit_room_name,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onMatch]);
}
