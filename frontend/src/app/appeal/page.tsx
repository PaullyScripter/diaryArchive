"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { AuthLayout } from "@/components/layout/auth-layout";

export default function AppealPage() {
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") || "";

  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
