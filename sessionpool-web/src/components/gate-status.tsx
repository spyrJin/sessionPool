"use client";

interface GateStatusProps {
  status: "upcoming" | "gate_open" | "matching" | "active" | "completed";
  startsAt?: string;
  gateDurationMinutes?: number;
}

export function GateStatus({
  status,
  startsAt,
  gateDurationMinutes = 5,
}: GateStatusProps) {
  const statusConfig = {
    upcoming: {
      label: "Upcoming",
      color: "bg-gray-700 text-gray-300",
      dot: "bg-gray-400",
    },
    gate_open: {
      label: "Gate Open",
      color: "bg-green-900/50 text-green-400",
      dot: "bg-green-400 animate-pulse",
    },
    matching: {
      label: "Matching...",
      color: "bg-yellow-900/50 text-yellow-400",
      dot: "bg-yellow-400 animate-pulse",
    },
    active: {
      label: "In Session",
      color: "bg-blue-900/50 text-blue-400",
      dot: "bg-blue-400",
    },
    completed: {
      label: "Completed",
      color: "bg-gray-800 text-gray-500",
      dot: "bg-gray-500",
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
