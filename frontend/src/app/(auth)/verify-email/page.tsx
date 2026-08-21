"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";

function VerifyEmailForm() {
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

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is invalid or has expired.");
      return;
    }
    (async () => {
      try {
        await apiClient.post("/auth/verify-email", { token });
        setStatus("success");
      } catch (err: unknown) {
        setStatus("error");
        setMessage(
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || "This verification link is invalid or has expired.",
        );
      }
    })();
  }, [token]);

  const handleDone = useCallback(() => {
    router.push("/login");
  }, [router]);

  return (
    <div className="mx-auto max-w-sm pt-16">
      <h1 className="font-serif text-xl mb-3">Email verification</h1>

      {status === "verifying" && <p className="text-sm text-muted">Verifying your email...</p>}

      {status === "success" && (
        <div className="space-y-4">
          <p className="text-sm text-success">Your email has been verified. Thank you!</p>
          <Button variant="primary" className="w-full" onClick={handleDone}>
            Log in
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
          <p className="text-xs text-muted">
            You can request a new verification email from your{" "}
            <Link href="/settings" className="text-link hover:text-link-hover underline underline-offset-2">
              account settings
            </Link>{" "}
            after logging in.
          </p>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm pt-16"><p className="text-sm text-muted">Loading...</p></div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}