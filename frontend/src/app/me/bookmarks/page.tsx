"use client";

import { ProtectedRoute } from "@/components/shared/protected-route";

function BookmarksContent() {
  return (
    <div>
      <div className="mb-5 pb-4 border-b border-border">
        <h1 className="font-serif text-xl font-semibold text-foreground">Bookmarks</h1>
        <p className="text-xs text-muted mt-0.5">Diaries you&apos;ve saved for later</p>
      </div>
      <p className="text-sm text-muted">You haven&apos;t bookmarked any diaries yet.</p>
    </div>
  );
}

export default function BookmarksPage() {
  return (
    <ProtectedRoute>
      <BookmarksContent />
    </ProtectedRoute>
  );
}
