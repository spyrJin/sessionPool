interface UserBadgeProps {
  instagram: string;
  streak: number;
  size?: "sm" | "md" | "lg";
}

export function UserBadge({ instagram, streak, size = "md" }: UserBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-1 gap-1",
    md: "text-sm px-3 py-1.5 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
  };

  const streakEmoji = streak > 0 ? "🔥" : "⭐";

  return (
    <span
      className={`inline-flex items-center rounded-full bg-gray-800 font-medium text-white ${sizeClasses[size]}`}
    >
      <span>
        {streakEmoji}
        {streak}
      </span>
      <span className="text-gray-400">{instagram}</span>
    </span>
  );
}
