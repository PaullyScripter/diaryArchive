"use client";

import { useAdminHealth } from "@/hooks/use-admin";

function StatusDot({ status }: { status: string }) {
  const color =
    status === "healthy" ? "bg-link" : "bg-destructive";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} mr-1.5`}
      aria-hidden="true"
    />
  );
}

export default function AdminHealthPage() {
  const { data, isLoading, isError, refetch } = useAdminHealth();
  const health = data?.data;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-medium">System Health</h1>
        <button
          onClick={() => refetch()}
          className="text-xs px-2 py-1 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12">
          <p className="text-sm text-muted mb-2">Failed to load health status</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
          >
            Retry
          </button>
        </div>
      )}

      {health && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <StatusDot status={health.status} />
            <span
              className={`text-sm font-medium ${
                health.status === "healthy" ? "text-link" : "text-destructive"
              }`}
            >
              {health.status === "healthy" ? "All Systems Healthy" : "Degraded"}
            </span>
          </div>

          {health.checks &&
            Object.entries(health.checks).map(([name, check]) => {
              const svc = check as { status: string; latency_ms: number; error?: string };
              return (
                <div
                  key={name}
                  className="border border-border p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <StatusDot status={svc.status} />
                      <span className="text-sm font-medium capitalize">{name}</span>
                    </div>
                    <span className="text-xs text-muted">{svc.latency_ms}ms</span>
                  </div>
                  {svc.error && (
                    <p className="text-xs text-destructive ml-5">{svc.error}</p>
                  )}
                </div>
              );
            })}

          <p className="text-xs text-muted mt-4">
            Last checked: {new Date(health.timestamp).toLocaleString()}
          </p>
          <p className="text-xs text-muted">Auto-refreshes every 30 seconds.</p>
        </div>
      )}
    </div>
  );
}
