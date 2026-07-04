"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminReports } from "@/hooks/use-admin";
import { showToast } from "@/components/shared/toast";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;
  const [note, setNote] = useState("");
  const { list, resolve, dismiss } = useAdminReports("all");

  const reports = list.data?.pages?.flatMap((p) => p.data ?? []) ?? [];
  const report = reports.find((r) => r.id === reportId);

  if (list.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-48 bg-muted animate-pulse" />
        <div className="h-20 bg-muted animate-pulse" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted mb-2">Report not found</p>
        <button
          onClick={() => router.push("/admin/reports")}
          className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  const handleResolve = () => {
    if (note.trim().length < 10) {
      showToast("Resolution note must be at least 10 characters");
      return;
    }
    resolve.mutate(
      { id: report.id, note: note.trim() },
      {
        onSuccess: () => {
          showToast("Report resolved");
          router.push("/admin/reports");
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: { message?: string } } } })
              ?.response?.data?.error?.message || "Failed to resolve";
          showToast(msg);
        },
      },
    );
  };

  const handleDismiss = () => {
    dismiss.mutate(report.id, {
      onSuccess: () => {
        showToast("Report dismissed");
        router.push("/admin/reports");
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message || "Failed to dismiss";
        showToast(msg);
      },
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push("/admin/reports")}
          className="text-xs text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
        >
          &larr; Reports
        </button>
        <h1 className="text-sm font-medium">Report Detail</h1>
      </div>

      <div className="border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted">Target Type: </span>
            <span>{report.target_type}</span>
          </div>
          <div>
            <span className="text-muted">Target ID: </span>
            <span className="font-mono">{report.target_id}</span>
          </div>
          <div>
            <span className="text-muted">Reason: </span>
            <span>{report.reason}</span>
          </div>
          <div>
            <span className="text-muted">Status: </span>
            <span
              className={
                report.status === "pending"
                  ? "text-accent"
                  : report.status === "resolved"
                    ? "text-link"
                    : "text-muted"
              }
            >
              {report.status}
            </span>
          </div>
          <div>
            <span className="text-muted">Reporter: </span>
            <span>{report.reporter.username}</span>
          </div>
          <div>
            <span className="text-muted">Reported: </span>
            <span>{fmtDate(report.created_at)}</span>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="text-xs text-muted mb-2 font-medium">Reported Content</div>
          {report.target_type === "diary" && (
            <div className="border border-border p-3 bg-overlay">
              {report.target_preview.content_deleted ? (
                <span className="text-xs text-muted italic">[This diary has been deleted]</span>
              ) : (
                <>
                  <div className="text-xs font-medium mb-1">
                    {report.target_preview.title || "Untitled"}
                  </div>
                  {report.target_preview.author_username && (
                    <div className="text-xs text-muted mb-1">
                      by @{report.target_preview.author_username}
                    </div>
                  )}
                  {report.target_preview.tags && report.target_preview.tags.length > 0 && (
                    <div className="text-xs text-muted mb-1">
                      Tags: {report.target_preview.tags.join(", ")}
                    </div>
                  )}
                  {report.target_preview.excerpt && (
                    <div className="text-xs text-foreground mt-1 leading-relaxed">
                      {report.target_preview.excerpt}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {report.target_type === "comment" && (
            <div className="border border-border p-3 bg-overlay">
              {report.target_preview.content_deleted ? (
                <span className="text-xs text-muted italic">[This comment has been deleted]</span>
              ) : (
                <>
                  {report.target_preview.author_username && (
                    <div className="text-xs text-muted mb-1">
                      @{report.target_preview.author_username}
                    </div>
                  )}
                  {report.target_preview.content && (
                    <div className="text-xs text-foreground leading-relaxed">
                      {report.target_preview.content}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {report.target_type === "user" && (
            <div className="border border-border p-3 bg-overlay">
              <div className="text-xs font-medium mb-1">
                @{report.target_preview.username || "unknown"}
                {report.target_preview.is_banned && (
                  <span className="ml-1 text-destructive">(banned)</span>
                )}
              </div>
              {report.target_preview.about && (
                <div className="text-xs text-muted mt-1">{report.target_preview.about}</div>
              )}
            </div>
          )}
        </div>

        {report.description && (
          <div>
            <div className="text-xs text-muted mb-1">Description</div>
            <div className="text-xs border border-border p-2 bg-overlay">
              {report.description}
            </div>
          </div>
        )}

        {report.resolution_note && (
          <div>
            <div className="text-xs text-muted mb-1">Resolution Note</div>
            <div className="text-xs border border-border p-2 bg-overlay">
              {report.resolution_note}
            </div>
          </div>
        )}

        {report.resolved_by && (
          <div className="text-xs text-muted">
            Resolved by {report.resolved_by}{" "}
            {report.resolved_at && `on ${fmtDate(report.resolved_at)}`}
          </div>
        )}

        {report.status === "pending" && (
          <div className="border-t border-border pt-3 space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">
                Resolution Note (required, min 10 chars)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full border border-border bg-background text-xs p-2 text-foreground resize-none"
                placeholder="Describe why this report is being resolved..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResolve}
                disabled={resolve.isPending}
                className="text-xs px-3 py-1 border-0 cursor-pointer bg-link text-white hover:opacity-80 disabled:opacity-50"
              >
                {resolve.isPending ? "Resolving..." : "Resolve Report"}
              </button>
              <button
                onClick={handleDismiss}
                disabled={dismiss.isPending}
                className="text-xs px-3 py-1 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground disabled:opacity-50"
              >
                {dismiss.isPending ? "Dismissing..." : "Dismiss Report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
