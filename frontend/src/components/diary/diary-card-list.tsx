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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border border-border rounded-lg space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {diaries.map((diary) => (
          <DiaryCard key={diary.id} diary={diary} />
        ))}
      </div>
      {hasNextPage && onLoadMore && (
        <div className="mt-6 text-center">
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
