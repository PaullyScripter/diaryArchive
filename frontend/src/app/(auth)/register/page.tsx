"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { useAuthStore } from "@/store/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!username.trim()) {
        setError("Username is required");
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
        setError("Username can only contain letters, numbers, underscores, and hyphens");
        return;
      }

      if (username.trim().length < 3 || username.trim().length > 20) {
        setError("Username must be between 3 and 20 characters");
        return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }

      setLoading(true);
      try {
        await register(username.trim(), password, email.trim() || undefined);
        router.push("/");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "response" in err) {
          const response = (err as { response: { data?: { error?: { message?: string } } } }).response;
          setError(response.data?.error?.message || "Registration failed");
        } else {
          setError("An unexpected error occurred");
        }
      } finally {
        setLoading(false);
      }
    },
    [username, password, email, register, router],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="mx-auto max-w-sm pt-16">
      <h1 className="font-serif text-xl mb-6">Register</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="text-xs text-muted">
            Username
          </label>
          <Input
            id="username"
            placeholder="Choose a username (3-20 characters)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? "register-error" : undefined}
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
            placeholder="Choose a password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? "register-error" : undefined}
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
        </div>

        <div>
          <label htmlFor="email" className="text-xs text-muted">
            Email <span className="text-subtle">(optional)</span>
          </label>
          <Input
            id="email"
            type="email"
            placeholder="For account recovery"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
        </div>

        {error && (
          <p id="register-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={loading} aria-busy={loading} className="w-full">
          {loading ? "Creating account..." : "Create account"}
        </Button>

        <p className="text-xs text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-link hover:text-link-hover underline underline-offset-2">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
