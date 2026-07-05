"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";

interface Achievement {
  id: string;
  type: string;
  tier: string;
  threshold: number;
  label: string;
  color: string;
  icon: string;
  shine?: boolean;
}

interface DisplayedBadge {
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

const TYPE_LABELS: Record<string, string> = {
  diaries: "Diaries", likes: "Likes", followers: "Followers", age: "Age", streak: "Streak",
};

const TIER_ORDER: Record<string, number> = {
  bronze: 0, silver: 1, gold: 2, diamond: 3, gradient: 4,
};

const FALLBACK_COLORS: Record<string, string> = {
  bronze: "#8B6914", silver: "#A8A8A8", gold: "#DAA520", diamond: "#87CEEB", gradient: "#9B59B6",
};

export function BadgeSelector() {
  const qc = useQueryClient();

  const { data: achievements, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const r = await apiClient.get("/achievements");
      return (r.data.data || r.data) as Achievement[];
    },
  });

  const { data: displayed } = useQuery({
    queryKey: ["achievements", "display"],
    queryFn: async () => {
      const r = await apiClient.get("/achievements/display");
      return (r.data.data || r.data) as DisplayedBadge[];
    },
  });

  const selectedTiers: Record<string, string> = {};
  (displayed || []).forEach((d) => { selectedTiers[d.type] = d.tier; });

  const setBadge = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.put(`/achievements/display/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievements"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
      showToast("Badge set");
    },
  });

  const clearBadge = useMutation({
    mutationFn: async (badgeType: string) => {
      await apiClient.delete(`/achievements/display/${badgeType}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievements"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
      showToast("Badge removed");
    },
  });

  if (isLoading) return <div className="text-sm text-muted">Loading...</div>;

  const items = achievements || [];
  if (items.length === 0) {
    return <p className="text-sm text-muted">No badges yet. Publish diaries and engage to earn them.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-subtle">One badge per category. Click to set, click again to change.</p>
      {Object.entries(TYPE_LABELS).map(([type, label]) => {
        const typeItems = items
          .filter((a) => a.type === type)
          .sort((a, b) => (TIER_ORDER[a.tier] || 0) - (TIER_ORDER[b.tier] || 0));
        if (typeItems.length === 0) return null;

        const icon = iconPaths[typeItems[0].icon] || iconPaths.book;
        const selectedTier = selectedTiers[type];

        return (
          <div key={type} className="flex items-center gap-3">
            <span className={`text-xs font-medium w-16 shrink-0 ${selectedTier ? "text-foreground" : "text-muted"}`}>
              {label}
              {selectedTier && <span className="ml-1 text-accent">&#x2713;</span>}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {typeItems.map((ach) => {
                const isGradient = ach.color.startsWith("linear-gradient");
                const fillColor = isGradient ? FALLBACK_COLORS[ach.tier] || "#9B59B6" : ach.color;
                const animClass = ach.tier === "diamond" ? "badge-diamond" : ach.tier === "gradient" ? "badge-gradient" : "";
                const isSelected = selectedTiers[type] === ach.tier;

                return (
                  <button
                    key={ach.id}
                    type="button"
                    onClick={() => setBadge.mutate(ach.id)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
                      isSelected
                        ? "border-accent bg-accent/10 text-foreground font-medium"
                        : "border-border text-foreground hover:border-accent"
                    }`}
                    title={ach.label}
                  >
                    <svg className={`w-3.5 h-3.5 ${animClass}`} viewBox="0 0 24 24" fill={fillColor}>
                      <path d={icon} />
                    </svg>
                    {ach.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => clearBadge.mutate(type)}
                className="text-xs text-subtle hover:text-destructive px-1 py-1"
              >
                clear
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
