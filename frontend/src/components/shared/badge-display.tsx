"use client";

import { BadgeData, BadgeIcon } from "@/components/shared/badge-icon";

export function BadgeDisplay({ badges, size = "sm" }: { badges: BadgeData[] | null | undefined; size?: "sm" | "md" }) {
  if (!badges || !Array.isArray(badges) || badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {badges.map((badge, index) => (
        <span key={index} title={badge.label} className="inline-flex items-center">
          <BadgeIcon badge={badge} size={size} />
        </span>
      ))}
    </span>
  );
}
