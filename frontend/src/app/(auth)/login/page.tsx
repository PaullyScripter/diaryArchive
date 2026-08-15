"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const clearBan = useAuthStore((s) => s.clearBan);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBanned = useAuthStore((s) => s.isBanned);
  const banReason = useAuthStore((s) => s.banReason);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!username.trim() || !password) {
        setError("Username and password are required");
        return;
      }

      setLoading(true);
      try {
        clearBan();
        await login(username.trim(), password);
        if (useAuthStore.getState().isBanned) {
          return;
        }
        const redirect = searchParams.get("redirect") || "/";
        router.push(redirect);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "response" in err) {
          const response = (err as { response: { data?: { error?: { message?: string } } } }).response;
          setError(response.data?.error?.message || "Invalid username or password");
        } else {
          setError("An unexpected error occurred");
        }
      } finally {
        setLoading(false);
      }
    },
    [username, password, login, clearBan, searchParams, router],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  if (isBanned) {
    return (
      <div className="mx-auto max-w-sm pt-16">
        <h1 className="font-serif text-xl mb-6">Account Suspended</h1>
        <div className="border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm text-destructive font-medium">Your account has been banned.</p>
          <p className="text-sm text-foreground">{banReason}</p>
          <a
            href={`/appeal?username=${encodeURIComponent(username)}`}
            className="inline-block text-sm px-3 py-1.5 bg-foreground text-background hover:opacity-80 no-underline"
          >
            Appeal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm pt-16">
      <h1 className="font-serif text-xl mb-6">Log in</h1>

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
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            autoComplete="username"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-xs text-muted">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p id="login-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={loading} aria-busy={loading} className="w-full">
          {loading ? "Logging in..." : "Log in"}
        </Button>

        <p className="text-xs text-muted text-center">
          <Link href="/forgot-password" className="text-link hover:text-link-hover underline underline-offset-2">
            Forgot your password?
          </Link>
        </p>

        <p className="text-xs text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-link hover:text-link-hover underline underline-offset-2">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm pt-16"><p className="text-sm text-muted">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
