"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { AuthLayout } from "@/components/layout/auth-layout";

interface ExistingAppeal {
  has_appeal: boolean;
  reason?: string;
  ticket_id?: string;
  status?: string;
  subject?: string;
  last_message_preview?: string;
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

  if (existingAppeal) {
    return (
      <AuthLayout>
        <div className="mx-auto max-w-sm">
          <h1 className="font-serif text-xl mb-4">Your Appeal</h1>
          <div className="border border-border p-4 space-y-3">
            <div className="text-xs text-muted">
              <span className="font-medium text-foreground">Status: </span>
              <span className={existingAppeal.status === "open" ? "text-link" : "text-muted"}>
                {existingAppeal.status}
              </span>
            </div>
            {existingAppeal.assigned_admin_username && (
              <div className="text-xs text-muted">
                <span className="font-medium text-foreground">Reviewer: </span>
                {existingAppeal.assigned_admin_username}
              </div>
            )}
            {existingAppeal.created_at && (
              <div className="text-xs text-muted">
                <span className="font-medium text-foreground">Submitted: </span>
                {new Date(existingAppeal.created_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </div>
            )}
            {existingAppeal.last_message_preview && (
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted">Your message:</p>
                <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">{existingAppeal.last_message_preview}</p>
              </div>
            )}
            <p className="text-xs text-muted">
              Your appeal is pending review. A moderator will respond soon. You cannot submit another appeal while this one is open.
            </p>
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
