"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, X } from "lucide-react";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";

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

const CATEGORY_LABELS: Record<string, string> = {
  account_help: "Account Help",
  username_change: "Username Change",
  general_inquiry: "General Inquiry",
  feature_request: "Feature Request",
  report_problem: "Report a Problem",
};

function MessageBubble({ msg }: { msg: TicketMessage }) {
  return (
    <div className={`p-3 ${msg.is_admin ? "bg-overlay border border-border" : "border border-border"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">
          {msg.sender_username}
          {msg.is_admin && (
            <span className="ml-1 text-accent text-xs">(admin)</span>
          )}
        </span>
        <span className="text-xs text-muted">{fmtDate(msg.created_at)}</span>
      </div>
      {msg.message && (
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {msg.message}
        </div>
      )}
      {msg.media_url && (
        <div className="mt-2">
          {msg.media_type?.startsWith("image/") ? (
            <img
              src={msg.media_url}
              alt="attachment"
              className="max-w-full max-h-80 rounded border border-border object-contain"
            />
          ) : (
            <a
              href={msg.media_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-link hover:underline"
            >
              View attachment
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ticketId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ id: string; url: string; mime_type: string } | null>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery<TicketDetail>({
    queryKey: ["my-ticket", ticketId],
    queryFn: async () => {
      const response = await apiClient.get(`/tickets/${ticketId}`);
      return response.data.data || response.data;
    },
    refetchInterval: 5000,
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
        await apiClient.post(`/tickets/${ticketId}/reply`, {
          message: reply.trim(),
          media_id: pendingMedia?.id || undefined,
        });
        setReply("");
        setPendingMedia(null);
        showToast("Reply sent");
        queryClient.invalidateQueries({ queryKey: ["my-ticket", ticketId] });
        queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || "Failed to send reply";
        showToast(msg);
      } finally {
        setSending(false);
      }
    },
    [reply, pendingMedia, ticketId, queryClient],
  );

  const closeMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/tickets/${ticketId}/close`);
    },
    onSuccess: () => {
      showToast("Ticket closed");
      queryClient.invalidateQueries({ queryKey: ["my-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || "Failed to close ticket";
      showToast(msg);
    },
  });

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="h-4 w-48 bg-muted animate-pulse mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (isError || !ticket) {
    return (
      <ProtectedRoute>
        <div className="max-w-2xl mx-auto py-8 px-4 text-center">
          <p className="text-sm text-muted mb-2">Ticket not found</p>
          <Button variant="secondary" size="sm" onClick={() => router.push("/me/reports-tickets")}>
            Back to Tickets
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  const isOpen = ticket.status === "open";

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <button
          onClick={() => router.push("/me/reports-tickets")}
          className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0 mb-4"
        >
          &larr; Back to Tickets
        </button>

        <div className="border border-border p-4 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="font-serif text-lg mb-2">{ticket.subject}</h1>
              <div className="text-xs text-muted space-y-0.5">
                <div>Category: {CATEGORY_LABELS[ticket.category] || ticket.category}</div>
                <div>
                  Status:{" "}
                  <span className={isOpen ? "text-link" : "text-muted"}>
                    {isOpen ? "Open" : "Closed"}
                  </span>
                </div>
                {ticket.assigned_admin_username && (
                  <div>Assigned admin: {ticket.assigned_admin_username}</div>
                )}
                <div>Created: {fmtDate(ticket.created_at)}</div>
              </div>
            </div>
            {isOpen && (
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="text-xs px-3 py-1 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground disabled:opacity-50 shrink-0"
              >
                {closeMutation.isPending ? "Closing..." : "Close ticket"}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {ticket.messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {isOpen && (
          <form onSubmit={handleReply} className="border border-border p-3 space-y-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              maxLength={3000}
              className="w-full border border-border bg-background text-sm p-2 text-foreground resize-none"
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
              <button
                type="submit"
                disabled={sending || (!reply.trim() && !pendingMedia)}
                className="text-sm px-4 py-1.5 border-0 cursor-pointer bg-foreground text-background hover:opacity-80 disabled:opacity-40"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        )}

        {!isOpen && (
          <div className="text-center py-4 border border-border bg-overlay">
            <p className="text-sm text-muted">This ticket is closed.</p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
