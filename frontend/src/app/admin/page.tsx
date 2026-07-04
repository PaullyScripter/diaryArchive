"use client";

import { useAdminStats } from "@/hooks/use-admin";

export default function AdminOverviewPage() {
  const { data, isLoading, isError, refetch } = useAdminStats();
  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border border-border p-3">
            <div className="h-3 w-16 bg-muted animate-pulse mb-2" />
            <div className="h-6 w-12 bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted mb-2">Failed to load stats</p>
        <button
          onClick={() => refetch()}
          className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const cards = stats
    ? [
        { label: "Total Users", value: stats.users.total },
        { label: "Banned Users", value: stats.users.banned },
        { label: "Admins", value: stats.users.admins },
        { label: "Total Diaries", value: stats.diaries.total },
        { label: "Public", value: stats.diaries.public },
        { label: "Private", value: stats.diaries.private },
        { label: "Pending Reports", value: stats.reports.pending },
        { label: "Likes", value: stats.interactions.likes },
      ]
    : [];

  return (
    <div>
      <h1 className="text-sm font-medium mb-4">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="border border-border p-3"
          >
            <div className="text-xs text-muted mb-1">{card.label}</div>
            <div className="text-xl font-medium">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
