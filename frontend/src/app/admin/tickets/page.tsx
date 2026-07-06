"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";

interface TicketMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  is_admin: boolean;
  message: string;
  created_at: string;
}

interface TicketItem {
  id: string;
  user_id: string;
  user_username: string;
  category: string;
  subject: string;
  status: string;
  assigned_admin_id: string | null;
  assigned_admin_username: string | null;
  messages: TicketMessage[];
  created_at: string;
  updated_at: string;
}

interface TicketsResponse {
  data: TicketItem[];
  meta: { page: number; per_page: number; total: number; has_next: boolean; has_prev: boolean };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminTicketsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("open");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<TicketsResponse>({
    queryKey: ["admin", "tickets", statusFilter, page],
    queryFn: async () => {
      const response = await apiClient.get("/admin/tickets", {
        params: { status: statusFilter, page, per_page: 20 },
      });
      return response.data;
    },
  });

  const tickets = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
  };

  const takeMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      await apiClient.put(`/admin/tickets/${ticketId}/assign`);
    },
    onSuccess: () => {
      showToast("Ticket assigned to you");
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to take ticket";
      showToast(msg);
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      await apiClient.put(`/admin/tickets/${ticketId}/close`);
    },
    onSuccess: () => {
      showToast("Ticket closed");
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to close ticket";
      showToast(msg);
    },
  });

  return (
    <div>
      <h1 className="text-sm font-medium mb-4">Support Tickets</h1>

      <div className="flex gap-2 mb-4">
        {["open", "closed", "all"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`text-xs px-2 py-1 border-0 cursor-pointer ${
              statusFilter === s
                ? "bg-foreground text-background"
                : "bg-overlay text-muted hover:text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12">
          <p className="text-sm text-muted mb-2">Failed to load tickets</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && tickets.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No tickets found.</p>
      )}

      {tickets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted">Category</th>
                <th className="py-2 pr-3 font-medium text-muted">Subject</th>
                <th className="py-2 pr-3 font-medium text-muted">User</th>
                <th className="py-2 pr-3 font-medium text-muted">Assigned</th>
                <th className="py-2 pr-3 font-medium text-muted">Date</th>
                <th className="py-2 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-border">
                  <td className="py-2 pr-3 text-muted">{t.category}</td>
                  <td className="py-2 pr-3">
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="text-foreground hover:underline no-underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-muted">{t.user_username}</td>
                  <td className="py-2 pr-3 text-muted">
                    {t.assigned_admin_username || (
                      <span className="text-subtle italic">unassigned</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-muted">{fmtDate(t.created_at)}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {!t.assigned_admin_id && t.status === "open" && (
                        <button
                          onClick={() => takeMutation.mutate(t.id)}
                          disabled={takeMutation.isPending}
                          className="text-xs px-2 py-0.5 border-0 cursor-pointer bg-overlay text-foreground hover:bg-border disabled:opacity-50"
                        >
                          Take
                        </button>
                      )}
                      {t.status === "open" && (
                        <button
                          onClick={() => closeMutation.mutate(t.id)}
                          disabled={closeMutation.isPending}
                          className="text-xs px-2 py-0.5 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground disabled:opacity-50"
                        >
                          Close
                        </button>
                      )}
                      {t.status === "closed" && (
                        <span className="text-xs text-muted">Closed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
  );
}
