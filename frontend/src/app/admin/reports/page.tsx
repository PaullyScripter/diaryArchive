"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminReports } from "@/hooks/use-admin";
import { showToast } from "@/components/shared/toast";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState("pending");
  const { list, resolve, dismiss } = useAdminReports(status);

  const reports = list.data?.pages?.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div>
      <h1 className="text-sm font-medium mb-4">Content Reports</h1>

      <div className="flex gap-2 mb-4">
        {["pending", "resolved", "dismissed", "all"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-2 py-1 border-0 cursor-pointer ${
              status === s
                ? "bg-foreground text-background"
                : "bg-overlay text-muted hover:text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {list.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {list.isError && (
        <div className="text-center py-12">
          <p className="text-sm text-muted mb-2">Failed to load reports</p>
          <button
            onClick={() => list.refetch()}
            className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!list.isLoading && !list.isError && reports.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No reports found.</p>
      )}

      {reports.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted">Target</th>
                <th className="py-2 pr-3 font-medium text-muted">Reason</th>
                <th className="py-2 pr-3 font-medium text-muted">Reporter</th>
                <th className="py-2 pr-3 font-medium text-muted">Date</th>
                <th className="py-2 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/admin/reports/${r.id}`}
                      className="text-foreground hover:underline no-underline"
                    >
                      <div className="text-xs font-medium">
                        {r.target_type}
                        {r.target_preview.author_username && ` by @${r.target_preview.author_username}`}
                      </div>
                      {r.target_type === "diary" && r.target_preview.title && (
                        <div className="text-[11px] text-muted truncate max-w-[200px]">
                          {r.target_preview.content_deleted
                            ? "[Deleted]"
                            : r.target_preview.title}
                        </div>
                      )}
                      {r.target_type === "comment" && r.target_preview.content && (
                        <div className="text-[11px] text-muted truncate max-w-[200px]">
                          {r.target_preview.content}
                        </div>
                      )}
                      {r.target_type === "user" && r.target_preview.username && (
                        <div className="text-[11px] text-muted">
                          @{r.target_preview.username}
                          {r.target_preview.is_banned && " (banned)"}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-muted">{r.reason}</td>
                  <td className="py-2 pr-3 text-muted">{r.reporter.username}</td>
                  <td className="py-2 pr-3 text-muted">{fmtDate(r.created_at)}</td>
                  <td className="py-2">
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            resolve.mutate(
                              { id: r.id, note: "Resolved by admin review" },
                              {
                                onSuccess: () => showToast("Report resolved"),
                                onError: (err: unknown) => {
                                  const msg =
                                    (err as { response?: { data?: { error?: { message?: string } } } })
                                      ?.response?.data?.error?.message || "Failed to resolve";
                                  showToast(msg);
                                },
                              },
                            )
                          }
                          className="text-xs px-2 py-0.5 border-0 cursor-pointer bg-link text-white hover:opacity-80"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() =>
                            dismiss.mutate(r.id, {
                              onSuccess: () => showToast("Report dismissed"),
                              onError: (err: unknown) => {
                                const msg =
                                  (err as { response?: { data?: { error?: { message?: string } } } })
                                    ?.response?.data?.error?.message || "Failed to dismiss";
                                showToast(msg);
                              },
                            })
                          }
                          className="text-xs px-2 py-0.5 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {r.status !== "pending" && (
                      <span className={`text-xs ${r.status === "resolved" ? "text-link" : "text-muted"}`}>
                        {r.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.hasNextPage && (
        <div className="mt-4 text-center">
          <button
            onClick={() => list.fetchNextPage()}
            className="text-xs text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
