"use client";

import Link from "next/link";
import { BrowseSidebar } from "@/components/diary/browse-sidebar";
import {
  useDiaries,
  useRandomDiary,
  usePopularTags,
  useEmotions,
} from "@/hooks/use-diaries";
import { DiaryCard, type DiaryCardData } from "@/components/diary/diary-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TagBadge } from "@/components/shared/tag-badge";
import { EmotionBadge } from "@/components/shared/emotion-badge";

export default function Home() {
  const {
    data: diariesData,
    isLoading: diariesLoading,
    fetchNextPage,
    hasNextPage,
  } = useDiaries({ sort: "latest" });
  const { data: randomDiary, refetch: shuffleRandom } = useRandomDiary();
  const { data: popularTags } = usePopularTags();
  const { data: emotions } = useEmotions();

  const latestDiaries: DiaryCardData[] =
    diariesData?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="flex gap-8 lg:gap-10">
      <BrowseSidebar />

      <div className="min-w-0 flex-1">
        <div className="mb-5 pb-4 border-b border-border">
          <div className="flex items-baseline justify-between">
            <h1 className="font-serif text-xl font-semibold text-foreground">
              Recent Diaries
            </h1>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Public entries from the archive
          </p>
        </div>

        {diariesLoading ? (
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
        ) : latestDiaries.length > 0 ? (
          <div>
            <div>
              {latestDiaries.map((diary) => (
                <DiaryCard key={diary.id} diary={diary} />
              ))}
            </div>
            {hasNextPage && (
              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-muted">
              No public diaries yet. Be the first to share.
            </p>
            <Link
              href="/diary/new"
              className="inline-block mt-3 text-sm text-link hover:underline"
            >
              Write your first diary
            </Link>
          </div>
        )}

        {randomDiary && (
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-foreground">
                Random Diary
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => shuffleRandom()}
              >
                Shuffle
              </Button>
            </div>
            <DiaryCard diary={randomDiary as unknown as DiaryCardData} />
          </div>
        )}

        {popularTags && popularTags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
              Browse by Tags
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              {popularTags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/explore?tag=${tag}`}
                  className="inline-block"
                >
                  <span className="inline-block px-2 py-1 rounded-sm text-xs bg-tag-bg text-muted hover:text-foreground hover:bg-border transition-colors no-underline">
                    #{tag} <span className="text-subtle">{count}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {emotions && emotions.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
              Browse by Emotion
            </h2>
            <div className="flex gap-2 flex-wrap">
              {emotions.map(({ emotion, count }) => (
                <Link
                  key={emotion}
                  href={`/explore?emotion=${emotion}`}
                  className="no-underline"
                >
                  <EmotionBadge emotion={emotion} />
                  {count > 0 && (
                    <span className="text-xs text-subtle ml-1">{count}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
