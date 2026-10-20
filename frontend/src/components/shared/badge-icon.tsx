"use client";

import { useId } from "react";

export interface BadgeData {
  type: string;
  tier: string;
  label: string;
  color: string;
  icon: string;
  shine?: boolean;
  anim?: string;
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

const BUG_DARK = "#166534";
const BUG_LIGHT = "#BBF7D0";
const BUG_LEGS: { d: string; pair: "front" | "middle" | "back" }[] = [
  { d: "M7.1 10.8 3.1 9.7", pair: "front" },
  { d: "M6.8 13.6 2.6 13.3", pair: "middle" },
  { d: "M7.2 16.2 3.2 17.4", pair: "back" },
  { d: "M16.9 10.8 20.9 9.7", pair: "front" },
  { d: "M17.2 13.6 21.4 13.3", pair: "middle" },
  { d: "M16.8 16.2 20.8 17.4", pair: "back" },
];

const BUG_LEG_DELAY: Record<"front" | "middle" | "back", string> = {
  front: "0s",
  middle: "-0.2s",
  back: "-0.4s",
};

function BugIcon({ color, className }: { color: string; className: string }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10.1" fill={color} opacity="0.12" />
      <circle cx="12" cy="12" r="9.6" stroke={color} strokeWidth="0.75" opacity="0.42" />
      <path d="M10.5 5.7 8.3 3.1M13.5 5.7l2.2-2.6" stroke={BUG_DARK} strokeWidth="1.15" strokeLinecap="round" />
      <circle cx="8.15" cy="2.95" r="0.72" fill={BUG_DARK} />
      <circle cx="15.85" cy="2.95" r="0.72" fill={BUG_DARK} />
      {BUG_LEGS.map((leg) => (
        <path
          key={leg.d}
          d={leg.d}
          className="badge-bug-legs"
          style={{ animationDelay: BUG_LEG_DELAY[leg.pair] }}
          stroke={BUG_DARK}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      ))}
      <path d="M11.25 8.1C8.1 7.5 6.45 9.55 6.45 12.75c0 2.1 1.1 3.7 2.55 4.45 1.05-.95 1.78-2.25 2.25-3.85Z" fill={BUG_LIGHT} stroke={BUG_DARK} strokeWidth="0.72" />
      <path d="M12.75 8.1c3.15-.6 4.8 1.45 4.8 4.65 0 2.1-1.1 3.7-2.55 4.45-1.05-.95-1.78-2.25-2.25-3.85Z" fill={BUG_LIGHT} stroke={BUG_DARK} strokeWidth="0.72" />
      <path d="M12 7.4c2.2 0 3.85 1.85 3.85 4.7v1.45c0 2.75-1.55 4.85-3.85 4.85s-3.85-2.1-3.85-4.85V12.1C8.15 9.25 9.8 7.4 12 7.4Z" fill={color} stroke={BUG_DARK} strokeWidth="0.82" />
      <path d="M12 8v9.95" stroke={BUG_DARK} strokeWidth="0.72" strokeLinecap="round" opacity="0.8" />
      <circle cx="10.55" cy="10.55" r="0.9" fill="#F0FDF4" />
      <circle cx="13.45" cy="10.55" r="0.9" fill="#F0FDF4" />
      <circle cx="10.55" cy="10.65" r="0.38" fill={BUG_DARK} />
      <circle cx="13.45" cy="10.65" r="0.38" fill={BUG_DARK} />
      <path d="M10.25 14.65h3.5" stroke={BUG_DARK} strokeWidth="0.68" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function BadgeIcon({ badge, size = "sm" }: { badge: BadgeData; size?: "sm" | "md" }) {
  const gid = useId();
  const isGradient = badge.color.startsWith("linear-gradient");
  const color = badge.color || FALLBACKS[badge.tier] || "#8B6914";
  const sizeClass = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  const bugSizeClass = size === "md" ? "w-6 h-6" : "w-4 h-4";
  const animClass = badge.tier === "gradient" ? "badge-gradient" : badge.tier === "diamond" ? "badge-diamond" : "";

  if (badge.icon === "bug") return <BugIcon color={color} className={bugSizeClass} />;

  const icon = iconPaths[badge.icon] || iconPaths.book;
  return (
    <svg className={`${sizeClass} shrink-0 ${animClass}`} viewBox="0 0 24 24" fill={isGradient ? `url(#${gid})` : color} aria-hidden="true">
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
