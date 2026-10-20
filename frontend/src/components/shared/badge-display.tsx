"use client";

import { BadgeData, BadgeIcon } from "@/components/shared/badge-icon";

export function BadgeDisplay({ badges, size = "sm" }: { badges: BadgeData[] | null | undefined; size?: "sm" | "md" }) {
  if (!badges || !Array.isArray(badges) || badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Achievements">
      {badges.map((badge, index) => (
        <span key={`${badge.type}-${badge.tier}-${index}`} title={badge.label} className="inline-flex items-center">
          <BadgeIcon badge={badge} size={size} />
          <span className="sr-only">{badge.label}</span>
        </span>
      ))}
    </span>
  );
}
