interface BadgeData {
  type: string;
  tier: string;
  label: string;
  color: string;
  icon: string;
  shine?: boolean;
}

export function BadgeDisplay({ badge, size = "sm" }: { badge: BadgeData | null | undefined; size?: "sm" | "md" }) {
  if (!badge) return null;

  const isGradient = badge.color.startsWith("linear-gradient");
  const sizeClass = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";

  const icon = badge.icon === "heart"
    ? "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
    : "M4 19.5A2.5 2.5 0 0 1 6.5 17H20a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 0 4 5.5v14z";

  return (
    <span className="inline-flex items-center" title={badge.label}>
      <svg
        className={`${sizeClass} ${badge.shine ? "animate-[admin-star-spin_3s_ease-in-out_infinite]" : ""}`}
        viewBox="0 0 24 24"
        fill={isGradient ? "url(#badge-grad)" : badge.color}
        stroke={isGradient ? "none" : badge.color}
        strokeWidth={1}
        style={isGradient ? {} : { fill: badge.color }}
      >
        {isGradient && (
          <defs>
            <linearGradient id="badge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#87CEEB" />
              <stop offset="100%" stopColor="#9B59B6" />
            </linearGradient>
          </defs>
        )}
        <path d={icon} />
      </svg>
    </span>
  );
}
