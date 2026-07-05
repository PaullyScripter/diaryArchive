"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeDisplay } from "@/components/shared/badge-display";

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
    mutationFn: async () => {
      await apiClient.delete("/achievements/display");
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

export function BadgeSelector() {
  const { data: achievements, isLoading } = useAchievements();
  const setBadge = useSetBadge();
  const clearBadge = useClearBadge();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-overlay/10 animate-pulse" />
        ))}
      </div>
    );
  }

  const items = achievements || [];
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">No badges earned yet.</p>
        <p className="text-xs text-subtle mt-1">
          Publish diaries, receive likes and followers to earn badges.
        </p>
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => {
    const typeOrder = a.type.localeCompare(b.type);
    if (typeOrder !== 0) return typeOrder;
    return (TIER_ORDER[a.tier] || 0) - (TIER_ORDER[b.tier] || 0);
  });

  const typeLabels: Record<string, string> = {
    diaries: "Diaries",
    likes: "Likes Received",
    followers: "Followers",
    age: "Account Age",
    streak: "Writing Streak",
  };

  return (
    <div className="space-y-4">
      {Object.entries(typeLabels).map(([type, label]) => {
        const typeItems = sorted.filter((a) => a.type === type);
        if (typeItems.length === 0) return null;
        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {typeItems.map((ach) => (
                  <button
                    key={ach.id}
                    type="button"
                    onClick={() => setBadge.mutate(ach.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:border-accent hover:bg-accent/5 transition-colors text-sm"
                  >
                    <BadgeDisplay badge={ach} size="md" />
                    <span className="text-foreground">{ach.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <div className="flex justify-end pt-2">
        <Button variant="ghost" size="sm" onClick={() => clearBadge.mutate()}>
          Remove badge
        </Button>
      </div>
    </div>
  );
}
