"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { useMyBookmarks } from "@/hooks/use-social";
import { DiaryCard, type DiaryCardData } from "@/components/diary/diary-card";
import { Button } from "@/components/ui/button";

function BookmarksContent() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMyBookmarks();
  const diaries: DiaryCardData[] = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = data?.pages[0]?.meta?.total ?? 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-muted" />
          <h1 className="font-serif text-xl font-semibold text-foreground">
            Bookmarked Diaries
          </h1>
        </div>
        <p className="text-xs text-muted mt-0.5">
          {total} {total === 1 ? "diary" : "diaries"} you&apos;ve saved for later
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-3 border-b border-border last:border-b-0 h-24 animate-pulse bg-overlay/5" />
          ))}
        </div>
      ) : diaries.length === 0 ? (
        <div className="text-center py-16">
          <Bookmark className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">No bookmarks yet.</p>
          <p className="text-xs text-subtle mt-1">
            Bookmark diaries you want to read later.
          </p>
          <Link href="/explore" className="inline-block mt-3 text-sm text-link hover:underline">
            Explore
          </Link>
        </div>
      ) : (
        <div>
          {diaries.map((diary) => (
            <DiaryCard key={diary.id} diary={diary} />
          ))}
          {hasNextPage && (
            <div className="mt-4 text-center">
              <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookmarksPage() {
  return <ProtectedRoute><BookmarksContent /></ProtectedRoute>;
}
