"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";

interface TicketItem {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketsResponse {
  data: TicketItem[];
}

interface ReportItem {
  id: string;
  target_type: string;
  reason: string;
  description: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
}

interface ReportsResponse {
  data: ReportItem[];
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

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  open: { text: "Open", className: "text-link" },
  closed: { text: "Closed", className: "text-muted" },
  pending: { text: "Pending", className: "text-accent" },
  resolved: { text: "Decision Made", className: "text-link" },
  dismissed: { text: "Dismissed", className: "text-muted" },
};

const CATEGORY_LABELS: Record<string, string> = {
  account_help: "Account Help",
  username_change: "Username Change",
  general_inquiry: "General Inquiry",
  feature_request: "Feature Request",
  report_problem: "Report a Problem",
};

function TicketCard({ ticket }: { ticket: TicketItem }) {
  const router = useRouter();
  const statusBadge = STATUS_BADGE[ticket.status] || { text: ticket.status, className: "text-muted" };

  return (
    <button
      onClick={() => router.push(`/me/reports-tickets/${ticket.id}`)}
      className="w-full p-3 text-left cursor-pointer bg-transparent border border-border flex items-center justify-between hover:bg-overlay transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-foreground truncate">{ticket.subject}</span>
          <span className={`text-xs shrink-0 ${statusBadge.className}`}>{statusBadge.text}</span>
        </div>
        <div className="text-xs text-muted">
          {CATEGORY_LABELS[ticket.category] || ticket.category} &middot; {fmtDate(ticket.created_at)}
        </div>
      </div>
      <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

function ReportCard({ report }: { report: ReportItem }) {
  const statusBadge = STATUS_BADGE[report.status] || { text: report.status, className: "text-muted" };

  return (
    <div className="border border-border p-3 flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-foreground">
            {report.target_type === "bug" ? "Bug Report" : report.target_type === "user" ? "Profile Report" : "Content Report"}
          </span>
          <span className={`text-xs shrink-0 ${statusBadge.className}`}>{statusBadge.text}</span>
        </div>
        <div className="text-xs text-muted">{report.reason}</div>
        {report.description && <div className="text-xs text-subtle mt-1 truncate">{report.description}</div>}
        {report.resolution_note && <div className="text-xs text-link mt-1">Resolution: {report.resolution_note}</div>}
        <div className="text-xs text-muted mt-1">{fmtDate(report.created_at)}</div>
      </div>
    </div>
  );
}

export default function ReportsTicketsPage() {
  const [tab, setTab] = useState<"tickets" | "reports">("tickets");

  const ticketsQuery = useQuery<TicketsResponse>({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const response = await apiClient.get("/tickets");
      return response.data;
    },
    refetchInterval: 10000,
  });

  const reportsQuery = useQuery<ReportsResponse>({
    queryKey: ["my-reports"],
    queryFn: async () => {
      const response = await apiClient.get("/reports");
      return response.data;
    },
  });

  const tickets = useMemo(() => ticketsQuery.data?.data ?? [], [ticketsQuery.data]);
  const reports = useMemo(() => reportsQuery.data?.data ?? [], [reportsQuery.data]);

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="font-serif text-xl mb-2">My Reports & Tickets</h1>
        <p className="text-sm text-muted mb-6">View the status of your submissions.</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("tickets")}
            className={`text-xs px-3 py-1 border-0 cursor-pointer ${
              tab === "tickets" ? "bg-foreground text-background" : "bg-overlay text-muted hover:text-foreground"
            }`}
          >
            My Tickets
          </button>
          <button
            onClick={() => setTab("reports")}
            className={`text-xs px-3 py-1 border-0 cursor-pointer ${
              tab === "reports" ? "bg-foreground text-background" : "bg-overlay text-muted hover:text-foreground"
            }`}
          >
            My Reports
          </button>
        </div>

        {tab === "tickets" && (
          <>
            {ticketsQuery.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted animate-pulse" />
                ))}
              </div>
            )}
            {ticketsQuery.isError && (
              <div className="text-center py-8">
                <p className="text-sm text-muted mb-2">Failed to load tickets</p>
                <Button variant="secondary" size="sm" onClick={() => ticketsQuery.refetch()}>Retry</Button>
              </div>
            )}
            {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted">No tickets yet.</p>
              </div>
            )}
            {tickets.length > 0 && (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "reports" && (
          <>
            {reportsQuery.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse" />
                ))}
              </div>
            )}
            {reportsQuery.isError && (
              <div className="text-center py-8">
                <p className="text-sm text-muted mb-2">Failed to load reports</p>
                <Button variant="secondary" size="sm" onClick={() => reportsQuery.refetch()}>Retry</Button>
              </div>
            )}
            {!reportsQuery.isLoading && !reportsQuery.isError && reports.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted">No reports yet.</p>
              </div>
            )}
            {reports.length > 0 && (
              <div className="space-y-2">
                {reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
