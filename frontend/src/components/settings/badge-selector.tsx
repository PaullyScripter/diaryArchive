"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";

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

function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const r = await apiClient.get("/achievements");
      return (r.data.data || r.data) as Achievement[];
    },
  });
}

function useSetBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.put(`/achievements/display/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievements"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
      showToast("Badge updated!");
    },
  });
}

function useClearBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (badgeType: string) => {
      await apiClient.delete(`/achievements/display/${badgeType}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievements"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
      showToast("Badge removed");
    },
  });
}

const TIER_ORDER: Record<string, number> = {
  bronze: 0, silver: 1, gold: 2, diamond: 3, gradient: 4,
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-700/10 text-amber-800 dark:text-amber-300 border-amber-700/20",
  silver: "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600",
  gold: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  diamond: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700",
  gradient: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700",
};

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  diaries: { label: "Diaries", icon: "book", desc: "Public diaries published" },
  likes: { label: "Likes", icon: "heart", desc: "Total likes received" },
  followers: { label: "Followers", icon: "users", desc: "People following you" },
  age: { label: "Account Age", icon: "clock", desc: "Time on DiaryArchive" },
  streak: { label: "Streak", icon: "flame", desc: "Consecutive writing days" },
};

const iconPaths: Record<string, string> = {
  heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 0 4 5.5v14z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  clock: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase ${TIER_COLORS[tier] || ""}`}>
      {tier}
    </span>
  );
}

export function BadgeSelector() {
  const { data: achievements, isLoading } = useAchievements();
  const setBadge = useSetBadge();
  const clearBadge = useClearBadge();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-overlay/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const items = achievements || [];
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">No badges earned yet.</p>
        <p className="text-xs text-subtle mt-1">
          Publish diaries, receive likes and followers to earn badges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">
        Click any badge to display it. You can show one badge per category (up to 5 total).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(CATEGORY_META).map(([type, meta]) => {
          const typeItems = items
            .filter((a) => a.type === type)
            .sort((a, b) => (TIER_ORDER[a.tier] || 0) - (TIER_ORDER[b.tier] || 0));

          const icon = iconPaths[meta.icon] || iconPaths.book;

          return (
            <div key={type} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={icon} />
                </svg>
                <div>
                  <p className="text-sm font-medium text-foreground">{meta.label}</p>
                  <p className="text-[11px] text-subtle">{meta.desc}</p>
                </div>
              </div>

              {typeItems.length === 0 ? (
                <p className="text-xs text-subtle italic">No badges earned</p>
              ) : (
                <div className="space-y-1.5">
                  {typeItems.map((ach) => (
                    <button
                      key={ach.id}
                      type="button"
                      onClick={() => setBadge.mutate(ach.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/10 transition-colors text-left"
                    >
                      <svg
                        className="w-4 h-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill={ach.color.startsWith("linear") ? "url(#bs-" + ach.label.replace(/\s/g, "") + ")" : ach.color}
                        stroke={ach.color.startsWith("linear") ? "none" : ach.color}
                        strokeWidth={1}
                      >
                        {ach.color.startsWith("linear") && (
                          <defs>
                            <linearGradient id={"bs-" + ach.label.replace(/\s/g, "")} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#87CEEB" />
                              <stop offset="100%" stopColor="#9B59B6" />
                            </linearGradient>
                          </defs>
                        )}
                        <path d={icon} />
                      </svg>
                      <span className="text-xs text-foreground flex-1">{ach.label}</span>
                      <TierBadge tier={ach.tier} />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => clearBadge.mutate(type)}
                    className="w-full text-xs text-subtle hover:text-destructive transition-colors py-1"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
