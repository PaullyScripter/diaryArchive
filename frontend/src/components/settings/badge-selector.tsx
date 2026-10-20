"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";
import { BadgeIcon } from "@/components/shared/badge-icon";

interface Achievement {
  id: string;
  type: string;
  tier: string;
  threshold: number;
  label: string;
  color: string;
  icon: string;
  shine?: boolean;
  anim?: string;
}

interface DisplayedBadge {
  type: string;
  tier: string;
  label: string;
  color: string;
  icon: string;
  shine?: boolean;
  anim?: string;
}

const TYPE_LABELS: Record<string, string> = {
  diaries: "Diaries", likes: "Likes", followers: "Followers", age: "Age", streak: "Streak", other: "Others",
};

const TIER_ORDER: Record<string, number> = {
  bronze: 0, silver: 1, gold: 2, diamond: 3, gradient: 4,
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

        const selectedTier = selectedTiers[type];

        return (
          <div key={type} className="flex items-center gap-3">
            <span className={`text-xs font-medium w-16 shrink-0 ${selectedTier ? "text-foreground" : "text-muted"}`}>
              {label}
              {selectedTier && <span className="ml-1 text-accent">&#x2713;</span>}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {typeItems.map((ach) => {
                const isBug = ach.icon === "bug";
                const isSelected = selectedTiers[type] === ach.tier;

                return (
                  <button
                    key={ach.id}
                    type="button"
                    onClick={() => setBadge.mutate(ach.id)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isBug
                        ? isSelected
                          ? "border-green-600/70 bg-green-500/15 text-foreground font-medium shadow-sm shadow-green-700/10"
                          : "border-green-600/35 bg-green-500/5 text-foreground hover:border-green-600/65 hover:bg-green-500/10"
                        : isSelected
                          ? "border-accent bg-accent/10 text-foreground font-medium"
                          : "border-border text-foreground hover:border-accent"
                    }`}
                    title={ach.label}
                  >
                    <BadgeIcon badge={ach} size="sm" />
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
