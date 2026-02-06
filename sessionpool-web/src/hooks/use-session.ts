"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SessionState {
  session: any | null;
  group: any | null;
  partners: Array<{ instagram: string; streak: number }>;
  roomName: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to load and subscribe to a session's state for the current user.
 */
export function useSession(sessionId: string): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    group: null,
    partners: [],
    roomName: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const supabase = createClient();

    async function loadSession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Get session
        const { data: session } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (!session) throw new Error("Session not found");

        // Get user's group in this session
        const { data: groupMembers } = await supabase
          .from("group_members")
          .select("group_id, groups(id, livekit_room_name, session_id)")
          .eq("user_id", user.id);

        const myGroupMember = groupMembers?.find(
          (gm: any) => {
            const g = gm.groups as any;
            return g?.session_id === sessionId;
          }
        );

        if (!myGroupMember) {
          setState({
            session,
            group: null,
            partners: [],
            roomName: null,
            loading: false,
            error: null,
          });
          return;
        }

        const group = myGroupMember.groups as any;

        // Get partners
        const { data: allMembers } = await supabase
          .from("group_members")
          .select("user_id, profiles(instagram_handle, streak)")
          .eq("group_id", group.id);

        const partners = (allMembers ?? [])
          .filter((m: any) => m.user_id !== user.id)
          .map((m: any) => ({
            instagram: m.profiles.instagram_handle,
            streak: m.profiles.streak ?? 0,
          }));

        setState({
          session,
          group,
          partners,
          roomName: group.livekit_room_name,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
        }));
      }
    }

    loadSession();

    // Subscribe to session status changes
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setState((prev) => ({
            ...prev,
            session: { ...prev.session, ...payload.new },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return state;
}
