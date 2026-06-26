"use client";

import { ProtectedRoute } from "@/components/shared/protected-route";

function LikesContent() {
  return (
    <div>
      <div className="mb-5 pb-4 border-b border-border">
        <h1 className="font-serif text-xl font-semibold text-foreground">Likes</h1>
        <p className="text-xs text-muted mt-0.5">Diaries you&apos;ve liked</p>
      </div>
      <p className="text-sm text-muted">You haven&apos;t liked any diaries yet.</p>
    </div>
  );
}

export default function LikesPage() {
  return (
    <ProtectedRoute>
      <LikesContent />
    </ProtectedRoute>
  );
}
