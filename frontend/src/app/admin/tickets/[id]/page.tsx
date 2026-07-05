"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";
import { useAuthStore } from "@/store/auth-store";

interface TicketMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  is_admin: boolean;
  message: string;
  created_at: string;
}

interface TicketDetail {
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ticketId = params.id as string;
  const currentUser = useAuthStore((s) => s.user);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const { data: ticket, isLoading, isError, refetch } = useQuery<TicketDetail>({
    queryKey: ["admin", "ticket", ticketId],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/tickets/${ticketId}`);
      return response.data.data || response.data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
  };

  const takeMutation = useMutation({
    mutationFn: async () => {
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
    mutationFn: async () => {
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

  const handleReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reply.trim()) return;
      setSending(true);
      try {
        await apiClient.post(`/admin/tickets/${ticketId}/reply`, {
          message: reply.trim(),
        });
        setReply("");
        showToast("Reply sent");
        invalidate();
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
          "Failed to send reply";
        showToast(msg);
      } finally {
        setSending(false);
      }
    },
    [reply, ticketId],
  );

  const isAssignedToMe = ticket?.assigned_admin_id === currentUser?.id;
  const isOpen = ticket?.status === "open";

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-48 bg-muted animate-pulse" />
        <div className="h-40 bg-muted animate-pulse" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted mb-2">Ticket not found</p>
        <button
          onClick={() => router.push("/admin/tickets")}
          className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
        >
          Back to Tickets
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push("/admin/tickets")}
          className="text-xs text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
        >
          &larr; Tickets
        </button>
        <h1 className="text-sm font-medium">Ticket Detail</h1>
      </div>

      <div className="border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted">Category: </span>
            <span>{ticket.category}</span>
          </div>
          <div>
            <span className="text-muted">Status: </span>
            <span className={ticket.status === "open" ? "text-link" : "text-muted"}>
              {ticket.status}
            </span>
          </div>
          <div>
            <span className="text-muted">Subject: </span>
            <span>{ticket.subject}</span>
          </div>
          <div>
            <span className="text-muted">User: </span>
            <span>{ticket.user_username}</span>
          </div>
          <div>
            <span className="text-muted">Assigned: </span>
            <span>
              {ticket.assigned_admin_username || (
                <span className="text-subtle italic">unassigned</span>
              )}
            </span>
          </div>
          <div>
            <span className="text-muted">Updated: </span>
            <span>{fmtDate(ticket.updated_at)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border">
          {!ticket.assigned_admin_id && isOpen && (
            <button
              onClick={() => takeMutation.mutate()}
              disabled={takeMutation.isPending}
              className="text-xs px-3 py-1 border-0 cursor-pointer bg-overlay text-foreground hover:bg-border disabled:opacity-50"
            >
              {takeMutation.isPending ? "Taking..." : "Take this ticket"}
            </button>
          )}
          {isAssignedToMe && isOpen && (
            <button
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              className="text-xs px-3 py-1 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground disabled:opacity-50"
            >
              {closeMutation.isPending ? "Closing..." : "Close ticket"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wider">Thread</h2>
        {ticket.messages.map((msg) => (
          <div
            key={msg.id}
            className={`border p-3 ${msg.is_admin ? "border-border bg-overlay" : "border-border"}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground">
                {msg.sender_username}
                {msg.is_admin && (
                  <span className="ml-1 text-xs text-accent">(admin)</span>
                )}
              </span>
              <span className="text-xs text-muted">{fmtDate(msg.created_at)}</span>
            </div>
            <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {msg.message}
            </div>
          </div>
        ))}

        {isOpen && (
          <form onSubmit={handleReply} className="border border-border p-3 space-y-2">
            <label htmlFor="ticket-reply" className="text-xs text-muted">
              Add reply
            </label>
            <textarea
              id="ticket-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              maxLength={3000}
              className="w-full border border-border bg-background text-xs p-2 text-foreground resize-none"
              placeholder="Type your reply..."
              disabled={sending}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="text-xs px-3 py-1 border-0 cursor-pointer bg-link text-white hover:opacity-80 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
