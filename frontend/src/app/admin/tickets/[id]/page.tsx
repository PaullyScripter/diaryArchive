"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";
import { useAuthStore } from "@/store/auth-store";

interface TicketMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  is_admin: boolean;
  message: string;
  media_url?: string;
  media_type?: string;
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
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ id: string; url: string; mime_type: string } | null>(null);
  const [resolveAction, setResolveAction] = useState<"accept" | "deny" | null>(null);
  const [resolveMessage, setResolveMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery<TicketDetail>({
    queryKey: ["admin", "ticket", ticketId],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/tickets/${ticketId}`);
      return response.data.data || response.data;
    },
    refetchInterval: 5000,
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

  const resolveMutation = useMutation({
    mutationFn: async (args: { action: string; response_message: string }) => {
      await apiClient.put(`/admin/tickets/${ticketId}/resolve`, args);
    },
    onSuccess: (_, variables) => {
      showToast(`Appeal ${variables.action === "accept" ? "accepted" : "denied"}`);
      setResolveAction(null);
      setResolveMessage("");
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to resolve";
      showToast(msg);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const media = res.data.data || res.data;
      setPendingMedia({ id: media.id, url: media.url, mime_type: media.mime_type });
      showToast("Media attached");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || "Upload failed";
      showToast(msg);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reply.trim() && !pendingMedia) return;
      setSending(true);
      try {
        await apiClient.post(`/admin/tickets/${ticketId}/reply`, {
          message: reply.trim(),
          media_id: pendingMedia?.id || undefined,
        });
        setReply("");
        setPendingMedia(null);
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

      {isAssignedToMe && isOpen && ticket.category === "account_help" && (
        <div className="mt-3 border border-border p-3 space-y-2">
          <div className="text-xs font-medium text-foreground">Resolve Appeal</div>
          {!resolveAction ? (
            <div className="flex gap-2">
              <button
                onClick={() => setResolveAction("accept")}
                className="text-xs px-3 py-1 border-0 cursor-pointer bg-link text-white hover:opacity-80"
              >
                Accept (Unban)
              </button>
              <button
                onClick={() => setResolveAction("deny")}
                className="text-xs px-3 py-1 border-0 cursor-pointer bg-destructive text-white hover:opacity-80"
              >
                Deny (Keep Banned)
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${resolveAction === "accept" ? "text-link" : "text-destructive"}`}>
                  {resolveAction === "accept" ? "Accepting appeal" : "Denying appeal"}
                </span>
                <button
                  onClick={() => { setResolveAction(null); setResolveMessage(""); }}
                  className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0 underline"
                >
                  Cancel
                </button>
              </div>
              <label className="text-xs text-muted block">
                Response message (min 10 chars) <span className="text-subtle">({resolveMessage.trim().length}/10)</span>
              </label>
              <textarea
                value={resolveMessage}
                onChange={(e) => setResolveMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full border border-border bg-background text-xs p-2 text-foreground resize-none"
                placeholder={
                  resolveAction === "accept"
                    ? "Explain why the appeal is accepted..."
                    : "Explain why the appeal is denied..."
                }
              />
              <button
                onClick={() =>
                  resolveMutation.mutate({
                    action: resolveAction,
                    response_message: resolveMessage.trim(),
                  })
                }
                disabled={resolveMutation.isPending || resolveMessage.trim().length < 10}
                className={`text-xs px-3 py-1 border-0 cursor-pointer text-white hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                  resolveAction === "accept" ? "bg-link" : "bg-destructive"
                }`}
              >
                {resolveMutation.isPending
                  ? "Resolving..."
                  : resolveAction === "accept"
                    ? "Accept & Unban"
                    : "Deny & Keep Banned"}
              </button>
            </div>
          )}
        </div>
      )}

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
          {msg.media_url && (
            <div className="mt-2">
              {msg.media_type?.startsWith("image/") ? (
                <img src={msg.media_url} alt="attachment" className="max-w-full max-h-80 rounded border border-border object-contain" />
              ) : (
                <a href={msg.media_url} target="_blank" rel="noreferrer" className="text-xs text-link hover:underline">View attachment</a>
              )}
            </div>
          )}
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

            {pendingMedia && (
              <div className="flex items-center gap-2 text-xs bg-overlay p-2">
                <span className="text-muted truncate flex-1">Attachment: {pendingMedia.url.split("/").pop()}</span>
                <button
                  type="button"
                  onClick={() => setPendingMedia(null)}
                  className="text-muted hover:text-destructive cursor-pointer bg-transparent border-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="cursor-pointer text-muted hover:text-foreground">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading || sending}
                />
                <span className="inline-flex items-center gap-1 text-xs">
                  <Paperclip className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Attach image"}
                </span>
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sending || (!reply.trim() && !pendingMedia)}
                  className="text-xs px-3 py-1 border-0 cursor-pointer bg-link text-white hover:opacity-80 disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Reply"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
