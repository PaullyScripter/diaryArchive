"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";

type HistoryItem = {
  id: string;
  action: string;
  reviewed_by: string;
  details: { reason?: string; deadline?: string; is_banned?: boolean };
  created_at: string;
};

type TicketItem = {
  id: string;
  category: string;
  subject: string;
  status: string;
  is_appeal: boolean;
  created_at: string;
  updated_at: string;
};

type StandingResponse = {
  data: {
    standing: {
      status: string;
      is_banned: boolean;
      ban_reason: string | null;
      banned_at: string | null;
      bio_warning_count: number;
      active_warnings: {
        bio: { deadline: string | null; reason: string | null; active: boolean };
        username: { deadline: string | null; reason: string | null; active: boolean };
      };
      bio_edit_suspended_until: string | null;
      account_created_at: string;
    };
    warnings: HistoryItem[];
    moderation_history: HistoryItem[];
    tickets: TicketItem[];
    appeals: TicketItem[];
    history_policy: { permanent: boolean; message: string };
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function actionLabel(action: string) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AccountStandingContent() {
  const query = useQuery<StandingResponse>({
    queryKey: ["account-standing"],
    queryFn: async () => (await apiClient.get("/users/me/account-standing")).data,
  });

  if (query.isLoading) {
    return <div className="max-w-3xl mx-auto py-10 px-4 text-sm text-muted">Loading account standing…</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 text-center">
        <p className="text-sm text-muted mb-3">Unable to load your account standing.</p>
        <Button variant="secondary" size="sm" onClick={() => query.refetch()}>Try again</Button>
      </div>
    );
  }

  const { standing, warnings, moderation_history: history, tickets, appeals, history_policy: policy } = query.data.data;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Account Standing</h1>
        <p className="text-sm text-muted mt-1">A complete record of your account status and moderation history.</p>
      </div>

      <section className="border border-border p-4 space-y-3" aria-labelledby="current-standing-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="current-standing-heading" className="font-medium">Current standing</h2>
          <span className={standing.is_banned ? "text-destructive text-sm" : "text-link text-sm"}>
            {standing.is_banned ? "Banned" : "In good standing"}
          </span>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Account created</dt><dd>{formatDate(standing.account_created_at)}</dd></div>
          <div><dt className="text-muted">Recorded bio warnings</dt><dd>{standing.bio_warning_count}</dd></div>
          {standing.is_banned && <div className="sm:col-span-2"><dt className="text-muted">Ban reason</dt><dd>{standing.ban_reason || "No reason provided"}</dd></div>}
          {standing.bio_edit_suspended_until && <div><dt className="text-muted">Bio editing suspended until</dt><dd>{formatDate(standing.bio_edit_suspended_until)}</dd></div>}
        </dl>
      </section>

      <section className="border border-accent/40 bg-accent/5 p-4" aria-labelledby="history-policy-heading">
        <h2 id="history-policy-heading" className="font-medium mb-2">Permanent history policy</h2>
        <p className="text-sm leading-relaxed text-muted">{policy.message}</p>
      </section>

      <section aria-labelledby="active-warnings-heading">
        <h2 id="active-warnings-heading" className="font-serif text-lg mb-3">Active warnings</h2>
        <div className="space-y-2">
          {[{ label: "Bio", item: standing.active_warnings.bio }, { label: "Username", item: standing.active_warnings.username }].map(({ label, item }) => (
            <div key={label} className="border border-border p-3 text-sm">
              <div className="flex justify-between gap-3"><span className="font-medium">{label} warning</span><span className={item.active ? "text-accent" : "text-muted"}>{item.active ? "Active" : "No active warning"}</span></div>
              {item.active && <><p className="text-muted mt-1">Deadline: {formatDate(item.deadline)}</p><p className="text-muted mt-1">Reason: {item.reason || "Not provided"}</p></>}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="warnings-history-heading">
        <h2 id="warnings-history-heading" className="font-serif text-lg mb-3">Warning and ban history</h2>
        {history.length === 0 ? <p className="text-sm text-muted">No moderation actions are recorded.</p> : (
          <div className="space-y-2">{history.map((item) => (
            <div key={item.id} className="border border-border p-3 text-sm">
              <div className="flex justify-between gap-3"><span className="font-medium">{actionLabel(item.action)}</span><span className="text-muted">{formatDate(item.created_at)}</span></div>
              <p className="text-muted mt-1">Reviewed by {item.reviewed_by}</p>
              {item.details?.reason && <p className="text-muted mt-1">Reason: {item.details.reason}</p>}
            </div>
          ))}</div>
        )}
      </section>

      <section aria-labelledby="appeals-heading">
        <div className="flex items-center justify-between mb-3"><h2 id="appeals-heading" className="font-serif text-lg">Appeals and tickets</h2><Link href="/me/reports-tickets" className="text-sm text-link no-underline hover:underline">Open ticket center</Link></div>
        {tickets.length === 0 ? <p className="text-sm text-muted">No tickets or appeals are recorded.</p> : (
          <div className="space-y-2">{tickets.map((ticket) => (
            <Link key={ticket.id} href={`/me/reports-tickets/${ticket.id}`} className="block border border-border p-3 no-underline hover:bg-overlay">
              <div className="flex justify-between gap-3"><span className="text-sm font-medium">{ticket.is_appeal ? "Appeal: " : "Ticket: "}{ticket.subject}</span><span className="text-xs text-muted">{statusLabel(ticket.status)}</span></div>
              <p className="text-xs text-muted mt-1">{ticket.category} · Opened {formatDate(ticket.created_at)}</p>
            </Link>
          ))}</div>
        )}
        {appeals.length > 0 && <p className="text-xs text-muted mt-3">Appeal records shown above: {appeals.length}</p>}
      </section>
    </div>
  );
}

export default function AccountStandingPage() {
  return <ProtectedRoute><AccountStandingContent /></ProtectedRoute>;
}
