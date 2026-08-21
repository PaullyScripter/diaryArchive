"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { apiClient } from "@/lib/api/client";

function ResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState("");

  // P3.4: Read token from URL fragment (#token=...) instead of query parameter.
  // Fragments are never sent to the server in Referer headers or access logs.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      setToken(hash.slice(7));
    }
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!token) {
        setError("This reset link is invalid or has expired. Request a new one.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match");
        return;
      }

      setLoading(true);
      try {
        await apiClient.post("/auth/reset-password", { token, new_password: password });
        setSuccess(true);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || "Failed to reset password";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [token, password, confirm],
  );

  if (success) {
    return (
      <div className="mx-auto max-w-sm pt-16">
        <h1 className="font-serif text-xl mb-3">Password reset</h1>
        <p className="text-sm text-muted mb-6">
          Your password has been changed. Please log in with your new password.
        </p>
        <Button variant="primary" className="w-full" onClick={() => router.push("/login")}>
          Log in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm pt-16">
      <h1 className="font-serif text-xl mb-2">Choose a new password</h1>
      <p className="text-sm text-muted mb-6">Your other sessions will be signed out.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="text-xs text-muted">
            New password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
        </div>

        <div>
          <label htmlFor="confirm" className="text-xs text-muted">
            Confirm new password
          </label>
          <Input
            id="confirm"
            type="password"
            placeholder="Repeat your new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={loading || !token} aria-busy={loading} className="w-full">
          {loading ? "Resetting..." : "Reset password"}
        </Button>

        <p className="text-xs text-muted">
          <Link href="/forgot-password" className="text-link hover:text-link-hover underline underline-offset-2">
            Request a new link
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm pt-16"><p className="text-sm text-muted">Loading...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}