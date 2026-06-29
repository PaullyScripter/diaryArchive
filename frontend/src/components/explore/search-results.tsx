"use client";

import { DiaryCard } from "@/components/diary/diary-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExploreStore, type SearchResult } from "@/store/explore-store";

interface SearchResultsProps {
  diaries: SearchResult[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  total: number;
  onLoadMore: () => void;
}

export function SearchResults({
  diaries,
  isLoading,
  isError,
  error,
  isFetchingNextPage,
  hasNextPage,
  total,
  onLoadMore,
}: SearchResultsProps) {
  const selectedTags = useExploreStore((s) => s.selectedTags);

  if (isError) {
    return (
      <div className="text-center py-12" role="alert">
        <p className="text-sm text-destructive mb-2">Could not load search results.</p>
        <p className="text-xs text-subtle mb-3">
          {error?.message || "An unexpected error occurred."}
        </p>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-0" role="feed" aria-label="Search results" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="py-3 border-b border-border last:border-b-0">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (diaries.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <p className="text-sm text-muted mb-2">No diaries found.</p>
        <p className="text-xs text-subtle">
          Try different search terms, remove filters, or write the first diary in this category.
        </p>
      </div>
    );
  }

  return (
    <div role="feed" aria-label="Search results">
      <p className="text-xs text-muted mb-3">
        {total} {total === 1 ? "result" : "results"}
      </p>
      <div className="space-y-0">
        {diaries.map((diary) => (
          <DiaryCard
            key={diary.id}
            diary={{
              id: diary.id,
              title: diary.title,
              excerpt: diary.excerpt,
              author: diary.author,
              tags: diary.tags,
              emotion: diary.emotion,
              stats: diary.stats,
              created_at: diary.created_at,
              published_at: diary.created_at,
              highlight: true,
            }}
            selectedTags={selectedTags}
          />
        ))}
      </div>
      {hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more results"}
          </Button>
        </div>
      )}
    </div>
  );
}
