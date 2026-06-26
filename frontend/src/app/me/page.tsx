"use client";

import { ProtectedRoute } from "@/components/shared/protected-route";
import { useAuthStore } from "@/store/auth-store";

function MyDiariesContent() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <div className="mb-5 pb-4 border-b border-border">
        <h1 className="font-serif text-xl font-semibold text-foreground">My Diaries</h1>
        <p className="text-xs text-muted mt-0.5">
          {user?.username ? `Welcome back, ${user.username}` : "Your personal diary dashboard"}
        </p>
      </div>
      <p className="text-sm text-muted">You haven&apos;t written any diaries yet. Start writing to see them here.</p>
    </div>
  );
}

export default function MyDiariesPage() {
  return (
    <ProtectedRoute>
      <MyDiariesContent />
    </ProtectedRoute>
  );
}
