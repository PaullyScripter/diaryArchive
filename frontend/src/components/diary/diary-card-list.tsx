import { DiaryCard, type DiaryCardData } from "@/components/diary/diary-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface DiaryCardListProps {
  diaries: DiaryCardData[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  emptyMessage?: string;
  emptyAction?: { label: string; href: string };
}

export function DiaryCardList({
  diaries,
  isLoading,
  isError,
  hasNextPage,
  onLoadMore,
  isLoadingMore,
  emptyMessage = "No diaries yet.",
  emptyAction,
}: DiaryCardListProps) {
  if (isLoading) {
    return (
      <div className="space-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="py-3 border-b border-border last:border-b-0 space-y-2"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">Couldn&apos;t load diaries.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-link hover:underline mt-2 cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!diaries || diaries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">{emptyMessage}</p>
        {emptyAction && (
          <a
            href={emptyAction.href}
            className="inline-block mt-3 text-sm text-link hover:underline"
          >
            {emptyAction.label}
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <div>
        {diaries.map((diary) => (
          <DiaryCard key={diary.id} diary={diary} />
        ))}
      </div>
      {hasNextPage && onLoadMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
