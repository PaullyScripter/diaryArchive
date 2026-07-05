"use client";

import { useId } from "react";

interface BadgeData {
  type: string;
  tier: string;
  label: string;
  color: string;
  icon: string;
  shine?: boolean;
}

const iconPaths: Record<string, string> = {
  heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  book: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  clock: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
};

const FALLBACKS: Record<string, string> = {
  bronze: "#8B6914", silver: "#A8A8A8", gold: "#DAA520", diamond: "#87CEEB", gradient: "#9B59B6",
};

function BadgeIcon({ badge, size = "sm" }: { badge: BadgeData; size?: "sm" | "md" }) {
  const gid = useId();
  const isGradient = badge.color.startsWith("linear-gradient");
  const animClass =
    badge.tier === "gradient" ? "badge-gradient" :
    badge.tier === "diamond" ? "badge-diamond" : "";
  const icon = iconPaths[badge.icon] || iconPaths.book;
  const color = badge.color || FALLBACKS[badge.tier] || "#8B6914";
  const sizeClass = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";

  return (
    <svg
      className={`${sizeClass} shrink-0 ${animClass}`}
      viewBox="0 0 24 24"
      fill={isGradient ? `url(#${gid})` : color}
    >
      {isGradient && (
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#87CEEB" />
            <stop offset="100%" stopColor="#9B59B6" />
          </linearGradient>
        </defs>
      )}
      <path d={icon} />
    </svg>
  );
}

export function BadgeDisplay({ badges, size = "sm" }: { badges: BadgeData[] | null | undefined; size?: "sm" | "md" }) {
  if (!badges || !Array.isArray(badges) || badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1">
      {badges.map((b, i) => (
        <span key={i} title={b.label} className="inline-flex items-center">
          <BadgeIcon badge={b} size={size} />
        </span>
      ))}
    </span>
  );
}
