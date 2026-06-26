"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const refreshAuth = useAuthStore((s) => s.refreshAuth);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  return <>{children}</>;
}
