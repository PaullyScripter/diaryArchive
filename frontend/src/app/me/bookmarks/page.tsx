"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { ProtectedRoute } from "@/components/shared/protected-route";

function BookmarksContent() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        href="/me"
        className="text-xs text-muted hover:text-foreground no-underline hover:underline block mb-4"
      >
        &larr; Back to My Diaries
      </Link>

      <div className="mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-muted" />
          <h1 className="font-serif text-xl font-semibold text-foreground">Bookmarks</h1>
        </div>
        <p className="text-xs text-muted mt-0.5">Diaries you&apos;ve saved for later</p>
      </div>

      <div className="text-center py-16">
        <Bookmark className="w-8 h-8 text-muted mx-auto mb-3" />
        <p className="text-sm text-muted">No bookmarks yet.</p>
        <p className="text-xs text-subtle mt-1">
          Bookmark diaries to read them later. This feature will be fully available soon.
        </p>
      </div>
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