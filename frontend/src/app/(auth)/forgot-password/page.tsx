"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setMessage("");

      if (!username.trim()) {
        setError("Username is required");
        return;
      }

      setLoading(true);
      try {
        await apiClient.post("/auth/request-password-reset", { username: username.trim() });
        setMessage(
          "If this account has an email on file, a reset link has been sent. It expires in 1 hour.",
        );
        setUsername("");
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || "Something went wrong";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [username],
  );

  return (
    <div className="mx-auto max-w-sm pt-16">
      <h1 className="font-serif text-xl mb-2">Reset your password</h1>
      <p className="text-sm text-muted mb-6">
        Enter your username and we will send a reset link to the email on your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="text-xs text-muted">
            Username
          </label>
          <Input
            id="username"
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            autoComplete="username"
          />
        </div>

        {message && (
          <p className="text-sm text-success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={loading} aria-busy={loading} className="w-full">
          {loading ? "Sending..." : "Send reset link"}
        </Button>

        <p className="text-xs text-muted">
          Remembered it?{" "}
          <Link href="/login" className="text-link hover:text-link-hover underline underline-offset-2">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}