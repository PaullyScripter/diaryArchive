"use client";

import { useState } from "react";
import { useAdminAuditLogs } from "@/hooks/use-admin";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const AUDIT_ACTIONS = [
  "report_resolved",
  "report_dismissed",
  "ban_user",
  "unban_user",
  "promote_admin",
  "demote_admin",
];

export default function AdminAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { list } = useAdminAuditLogs({
    action: actionFilter || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  });

  const logs = list.data?.pages?.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div>
      <h1 className="text-sm font-medium mb-4">Audit Logs</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs border border-border bg-background text-foreground px-2 py-1"
        >
          <option value="">All Actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <label className="text-xs text-muted">From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-xs border border-border bg-background text-foreground px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-muted">To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-xs border border-border bg-background text-foreground px-2 py-1"
          />
        </div>
        {(actionFilter || fromDate || toDate) && (
          <button
            onClick={() => {
              setActionFilter("");
              setFromDate("");
              setToDate("");
            }}
            className="text-xs px-2 py-1 border-0 cursor-pointer bg-transparent text-muted hover:text-foreground"
          >
            Clear Filters
          </button>
        )}
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
          <p className="text-sm text-muted mb-2">Failed to load audit logs</p>
          <button
            onClick={() => list.refetch()}
            className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!list.isLoading && !list.isError && logs.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No audit logs found.</p>
      )}

      {logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted">Time</th>
                <th className="py-2 pr-3 font-medium text-muted">Admin</th>
                <th className="py-2 pr-3 font-medium text-muted">Action</th>
                <th className="py-2 pr-3 font-medium text-muted">Target</th>
                <th className="py-2 font-medium text-muted">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border">
                  <td className="py-2 pr-3 text-muted font-mono text-[11px]">
                    {fmtDate(log.created_at)}
                  </td>
                  <td className="py-2 pr-3">{log.admin_username}</td>
                  <td className="py-2 pr-3">
                    <span className="text-accent">{log.action}</span>
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {log.target_type}
                    {log.target_id ? `/${log.target_id.slice(-6)}` : ""}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() =>
                        setExpandedId(expandedId === log.id ? null : log.id)
                      }
                      className="text-xs text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
                    >
                      {expandedId === log.id ? "Hide" : "View"}
                    </button>
                    {expandedId === log.id && (
                      <pre className="mt-1 text-[10px] text-muted bg-overlay p-2 overflow-x-auto max-w-xs">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
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
