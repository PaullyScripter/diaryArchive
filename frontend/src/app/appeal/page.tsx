"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { AuthLayout } from "@/components/layout/auth-layout";

interface AppealMessage {
  id: string;
  sender_username: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface ExistingAppeal {
  has_appeal: boolean;
  reason?: string;
  ticket_id?: string;
  status?: string;
  subject?: string;
  messages?: AppealMessage[];
  created_at?: string;
  updated_at?: string;
  assigned_admin_username?: string;
}

function AppealForm() {
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") || "";

  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [existingAppeal, setExistingAppeal] = useState<ExistingAppeal | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const checkStatus = useCallback(async () => {
    if (!username.trim() || !password) return;
    setChecking(true);
    try {
      const res = await apiClient.post("/auth/appeal/status", {
        username: username.trim(),
        password,
      });
      const data = res.data?.data || res.data;
      if (data.has_appeal) {
        setExistingAppeal(data);
      }
    } catch {
      // ignore — probably wrong credentials or not banned
    } finally {
      setChecking(false);
    }
  }, [username, password]);

  useEffect(() => {
    if (initialUsername) {
      checkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [existingAppeal?.messages?.length]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!username.trim()) {
        setError("Username is required");
        return;
      }
      if (!password) {
        setError("Password is required");
        return;
      }
      if (!message.trim()) {
        setError("Message is required");
        return;
      }

      setLoading(true);
      try {
        await apiClient.post("/auth/appeal", {
          username: username.trim(),
          password,
          message: message.trim(),
        });
        setSuccess(true);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
          "Failed to submit appeal";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [username, password, message],
  );

  const handleReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!replyText.trim()) return;
      setSendingReply(true);
      try {
        await apiClient.post("/auth/appeal/reply", {
          username: username.trim(),
          password,
          message: replyText.trim(),
        });
        setReplyText("");
        await checkStatus();
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
          "Failed to send reply";
        setError(msg);
      } finally {
        setSendingReply(false);
      }
    },
    [username, password, replyText, checkStatus],
  );

  const fmtDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  if (existingAppeal) {
    const msgs = existingAppeal.messages || [];
    return (
      <AuthLayout>
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-xl mb-4">Your Appeal</h1>
          <div className="border border-border p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">
                Status:{" "}
                <span className={existingAppeal.status === "open" ? "text-link font-medium" : "text-muted"}>
                  {existingAppeal.status === "open" ? "Open" : existingAppeal.status}
                </span>
              </span>
              {existingAppeal.assigned_admin_username && (
                <span className="text-muted">
                  Reviewer: <span className="text-foreground">{existingAppeal.assigned_admin_username}</span>
                </span>
              )}
            </div>
            {existingAppeal.created_at && (
              <div className="text-xs text-muted">
                Submitted: {fmtDate(existingAppeal.created_at)}
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-3">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider">Conversation</h3>
              {msgs.map((msg) => (
                <div
                  key={msg.id}
                  className={`border p-2.5 ${msg.is_admin ? "border-border bg-overlay" : "border-border"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {msg.sender_username}
                      {msg.is_admin && (
                        <span className="ml-1 text-xs text-accent">(moderator)</span>
                      )}
                    </span>
                    <span className="text-xs text-muted">{fmtDate(msg.created_at)}</span>
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            {existingAppeal.status === "open" && (
              <form onSubmit={handleReply} className="border-t border-border pt-3 space-y-2">
                <label htmlFor="appeal-reply" className="text-xs text-muted">
                  Send a message
                </label>
                <textarea
                  id="appeal-reply"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-border bg-background text-sm p-2 text-foreground resize-none"
                  placeholder="Add to your appeal..."
                  disabled={sendingReply}
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  disabled={sendingReply || !replyText.trim()}
                  className="w-full"
                >
                  {sendingReply ? "Sending..." : "Send"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mx-auto max-w-sm">
        <h1 className="font-serif text-xl mb-6">Appeal</h1>

        {success ? (
          <div className="border border-border p-6 text-center">
            <p className="text-sm text-foreground mb-1">Appeal submitted</p>
            <p className="text-xs text-muted">
              Your appeal has been received. An administrator will review it and get back to you.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="appeal-username" className="text-xs text-muted">
                Username
              </label>
              <Input
                id="appeal-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                disabled={loading}
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="appeal-password" className="text-xs text-muted">
                Password
              </label>
              <Input
                id="appeal-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            {username.trim() && password && !existingAppeal && (
              <button
                type="button"
                onClick={checkStatus}
                disabled={checking}
                className="text-xs text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
              >
                {checking ? "Checking..." : "Check existing appeal"}
              </button>
            )}
            <div>
              <label htmlFor="appeal-message" className="text-xs text-muted">
                Your message
              </label>
              <textarea
                id="appeal-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                className="w-full border border-border bg-background text-sm p-2 text-foreground resize-none mt-1"
                placeholder="Explain why you believe your account should be reinstated..."
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? "Submitting..." : "Submit Appeal"}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

export default function AppealPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm pt-16"><p className="text-sm text-muted">Loading...</p></div>}>
      <AppealForm />
    </Suspense>
  );
}
