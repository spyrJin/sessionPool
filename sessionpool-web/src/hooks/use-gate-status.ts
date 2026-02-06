"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type SessionStatus = "upcoming" | "gate_open" | "matching" | "active" | "completed";

interface SessionUpdate {
  id: string;
  status: SessionStatus;
  [key: string]: any;
}

/**
 * Subscribe to realtime session status changes (gate open/close).
 */
export function useGateStatus(onUpdate: (session: SessionUpdate) => void) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("sessions-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: "status=in.(gate_open,matching,active,completed)",
        },
        (payload) => {
          onUpdate(payload.new as SessionUpdate);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
