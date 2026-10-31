"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";

export function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Preserve local query state (filters, editor ids) without accepting an
      // arbitrary external redirect target.
      const target = `${window.location.pathname}${window.location.search}`;
      const redirect = encodeURIComponent(target);
      router.push(`/login?redirect=${redirect}`);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (adminOnly && !user?.is_admin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="alert">
        <p className="text-sm text-muted">Access denied. Admin only.</p>
      </div>
    );
  }

  return <>{children}</>;
}
