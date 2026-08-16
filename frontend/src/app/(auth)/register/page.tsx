"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { useAuthStore } from "@/store/auth-store";

type Step = "credentials" | "confirmPassword" | "email";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (step === "credentials") {
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
        if (!acceptedTerms) {
          setError("You must read and agree to the Terms of Service and Privacy Policy to create an account");
          return;
        }
        setConfirmPassword("");
        setStep("confirmPassword");
        return;
      }

      if (step === "confirmPassword") {
        if (confirmPassword !== password) {
          setError("Passwords don't match. Please check the password you entered at the start.");
          return;
        }
        setError("");
        setStep("email");
        return;
      }

      if (step === "email") {
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError("Please enter a valid email address, or leave it empty");
          return;
        }
      }

      setLoading(true);
      try {
        await register(username.trim(), password, email.trim() || undefined, acceptedTerms);
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
    [step, username, password, confirmPassword, email, acceptedTerms, register, router],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const started = step !== "credentials";

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
          <PasswordInput
            id="password"
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

        {step === "confirmPassword" && (
          <div>
            <label htmlFor="confirmPassword" className="text-xs text-muted">
              Confirm password
            </label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Re-enter the password you chose above"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              aria-invalid={!!error}
              aria-describedby={error ? "register-error" : undefined}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-subtle">
              Re-enter your password to confirm it before continuing.
            </p>
          </div>
        )}

        {step === "email" && (
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
            <p className="mt-1 text-xs text-subtle">
              Optional, but strongly recommended. If you forget your password, only an
              email you provide here lets you recover your account.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-overlay/5 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              aria-describedby="terms-consent-note"
            />
            <span className="text-sm leading-relaxed text-muted" id="terms-consent-note">
              I have read and agree to the{" "}
              <Link
                href="/policy/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link hover:text-link-hover underline underline-offset-2"
              >
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link
                href="/policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link hover:text-link-hover underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              . Your private diaries are encrypted end-to-end; you must accept these
              terms to create an account.
            </span>
          </label>
        </div>

        {error && (
          <p id="register-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={loading || !acceptedTerms}
          aria-busy={loading}
          aria-disabled={!acceptedTerms}
          className="w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? "Creating account..."
            : step === "credentials"
              ? "Create account"
              : step === "confirmPassword"
                ? "Confirm password"
                : "Create account"}
        </Button>
        {!acceptedTerms && (
          <p className="text-xs text-subtle text-center">
            Agree to the Terms of Service and Privacy Policy to continue.
          </p>
        )}

        {started && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="note">
            <p className="text-xs leading-relaxed text-destructive">
              <strong>IMPORTANT — remember your password.</strong> Your password is the
              only key to your encrypted private diaries. A recovery email is optional
              but very helpful: without one, if you forget your password, your account
              and its content are permanently and irreversibly lost. There is no backdoor.
            </p>
          </div>
        )}

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