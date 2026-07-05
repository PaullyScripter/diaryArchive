"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";

interface BugReport {
  id: string;
  reporter: { id: string; username: string };
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  metadata: { url?: string; user_agent?: string } | null;
  status: string;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface BugsResponse {
  data: BugReport[];
  meta: { page: number; per_page: number; total: number; has_next: boolean; has_prev: boolean };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBugsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<BugsResponse>({
    queryKey: ["admin", "bugs", page],
    queryFn: async () => {
      const response = await apiClient.get("/admin/reports", {
        params: { target_type: "bug", page, per_page: 20 },
      });
      return response.data;
    },
  });

  const bugs = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "bugs"] });
  };

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.put(`/admin/reports/${id}`, {
        status: "resolved",
        resolution_note: "Bug resolved by admin",
      });
    },
    onSuccess: () => {
      showToast("Bug resolved");
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to resolve";
      showToast(msg);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.put(`/admin/reports/${id}`, { status: "dismissed" });
    },
    onSuccess: () => {
      showToast("Bug dismissed");
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to dismiss";
      showToast(msg);
    },
  });

  return (
    <div>
      <h1 className="text-sm font-medium mb-4">Bug Reports</h1>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12">
          <p className="text-sm text-muted mb-2">Failed to load bug reports</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && bugs.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No bug reports found.</p>
      )}

      {bugs.length > 0 && (
        <div className="space-y-3">
          {bugs.map((bug) => (
            <div key={bug.id} className="border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted mb-1">
                    Reported by <span className="text-foreground">{bug.reporter.username}</span> on {fmtDate(bug.created_at)}
                  </div>
                  {bug.description && (
                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap mb-2">
                      {bug.description}
                    </div>
                  )}
                  {bug.metadata?.url && (
                    <div className="text-xs text-subtle truncate mb-1">
                      URL: {bug.metadata.url}
                    </div>
                  )}
                  {bug.metadata?.user_agent && (
                    <div className="text-xs text-subtle truncate">
                      UA: {bug.metadata.user_agent}
                    </div>
                  )}
                  {bug.resolution_note && (
                    <div className="text-xs text-link mt-1">
                      Resolution: {bug.resolution_note}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {bug.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveMutation.mutate(bug.id)}
                        disabled={resolveMutation.isPending}
                        className="text-xs px-2 py-0.5 border-0 cursor-pointer bg-link text-white hover:opacity-80 disabled:opacity-50"
                      >
                        {resolveMutation.isPending ? "..." : "Resolve"}
                      </button>
                      <button
                        onClick={() => dismissMutation.mutate(bug.id)}
                        disabled={dismissMutation.isPending}
                        className="text-xs px-2 py-0.5 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground disabled:opacity-50"
                      >
                        {dismissMutation.isPending ? "..." : "Dismiss"}
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs ${bug.status === "resolved" ? "text-link" : "text-muted"}`}>
                      {bug.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {meta && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!meta.has_prev}
                className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0 disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs text-muted">
                Page {meta.page} of {Math.ceil(meta.total / meta.per_page)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!meta.has_next}
                className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
