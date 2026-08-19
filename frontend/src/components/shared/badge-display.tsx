"use client";

import { useId } from "react";

interface BadgeData {
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

// "Bug Catcher" icon. Filled rounded body + head, antennae, and separate leg
// paths so the legs can crawl independently (see .badge-bug-legs).
const BUG_BODY =
  "M12 7c3.3 0 6 2.4 6 5.6V14c0 3-2.7 5.2-6 5.2S6 17 6 14v-1.4C6 9.4 8.7 7 12 7z";
const BUG_HEAD = "M12 4.6a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z";
const BUG_ANTENNA = "M10.8 4.6 8.4 2.2 M13.2 4.6 15.6 2.2";
const BUG_ANTENNA_TIPS =
  "M8.4 2.2m-0.7 0a0.7 0.7 0 1 0 1.4 0 0.7 0.7 0 1 0-1.4 0 M15.6 2.2m-0.7 0a0.7 0.7 0 1 0 1.4 0 0.7 0.7 0 1 0-1.4 0";
// Each leg is its own path so the crawl can be desynchronized. The bug has
// three pairs (front / middle / back); each pair moves together but out of
// phase with the others (see .badge-bug-legs + --bug-leg-delay), so the legs
// don't all move in lock-step.
const BUG_LEGS: { d: string; pair: "front" | "middle" | "back" }[] = [
  { d: "M7.5 11 3 10.2", pair: "front" },
  { d: "M7.2 14 2.8 13.6", pair: "middle" },
  { d: "M7.5 17 3 17.6", pair: "back" },
  { d: "M16.5 11 21 10.2", pair: "front" },
  { d: "M16.8 14 21.2 13.6", pair: "middle" },
  { d: "M16.5 17 21 17.6", pair: "back" },
];

const BUG_LEG_DELAY: Record<"front" | "middle" | "back", string> = {
  front: "0s",
  middle: "-0.2s",
  back: "-0.4s",
};

const FALLBACKS: Record<string, string> = {
  bronze: "#8B6914", silver: "#A8A8A8", gold: "#DAA520", diamond: "#87CEEB", gradient: "#9B59B6",
};

function BadgeIcon({ badge, size = "sm" }: { badge: BadgeData; size?: "sm" | "md" }) {
  const gid = useId();
  const isGradient = badge.color.startsWith("linear-gradient");
  const isBug = badge.icon === "bug";
  const animClass =
    badge.anim === "bug-legs" ? "badge-bug-legs" :
    badge.tier === "gradient" ? "badge-gradient" :
    badge.tier === "diamond" ? "badge-diamond" : "";
  const icon = iconPaths[badge.icon] || iconPaths.book;
  const color = badge.color || FALLBACKS[badge.tier] || "#8B6914";
  const sizeClass = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  const bugSizeClass = size === "md" ? "w-6 h-6" : "w-4 h-4";

  if (isBug) {
    return (
      <svg
        className={`${bugSizeClass} shrink-0`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d={BUG_ANTENNA} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <path d={BUG_ANTENNA_TIPS} fill={color} />
        {BUG_LEGS.map((leg) => (
          <path
            key={leg.d}
            d={leg.d}
            className={animClass}
            style={{ animationDelay: BUG_LEG_DELAY[leg.pair] }}
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ))}
        <path d={BUG_HEAD} fill={color} />
        <path d={BUG_BODY} fill={color} />
      </svg>
    );
  }

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
    <span className="inline-flex items-center gap-1.5">
      {badges.map((b, i) => (
        <span key={i} title={b.label} className="inline-flex items-center">
          <BadgeIcon badge={b} size={size} />
        </span>
      ))}
    </span>
  );
}
