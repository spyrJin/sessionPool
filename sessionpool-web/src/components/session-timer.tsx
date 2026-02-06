"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionTimerProps {
  /** Session end time as ISO string */
  endsAt: string;
  /** Called when timer hits zero */
  onComplete: () => void;
}

export function SessionTimer({ endsAt, onComplete }: SessionTimerProps) {
  const calculateRemaining = useCallback(() => {
    const diff = new Date(endsAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, [endsAt]);

  const [remaining, setRemaining] = useState(calculateRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = calculateRemaining();
      setRemaining(seconds);

      if (seconds <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining < 60;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-2xl font-bold ${
        isUrgent
          ? "animate-pulse bg-red-900/50 text-red-400"
          : "bg-gray-800 text-white"
      }`}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
