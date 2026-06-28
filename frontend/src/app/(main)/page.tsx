"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { BrowseSidebar } from "@/components/diary/browse-sidebar";
import {
  useDiaries,
  useRandomDiary,
  usePopularTags,
  useEmotions,
} from "@/hooks/use-diaries";
import { useFollowingFeed } from "@/hooks/use-social";
import { useAuthStore } from "@/store/auth-store";
import { DiaryCard, type DiaryCardData } from "@/components/diary/diary-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TagBadge } from "@/components/shared/tag-badge";
import { EmotionBadge } from "@/components/shared/emotion-badge";

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

export default function Home() {
  const {
    data: diariesData,
    isLoading: diariesLoading,
  } = useDiaries({ sort: "latest", perPage: 5 });
  const { data: randomDiary, refetch: shuffleRandom } = useRandomDiary();
  const { data: popularTags } = usePopularTags();
  const { data: emotions } = useEmotions();
  const { data: followingFeed } = useFollowingFeed();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const randomTags = useMemo(() => pickRandom(popularTags ?? [], 25), [popularTags]);
  const randomEmotions = useMemo(() => pickRandom(emotions ?? [], 25), [emotions]);

  const latestDiaries: DiaryCardData[] =
    diariesData?.pages.flatMap((p) => p.data ?? []) ?? [];

  const followingDiaries: DiaryCardData[] = followingFeed?.data ?? [];

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
            {latestDiaries.map((diary) => (
              <DiaryCard key={diary.id} diary={diary} />
            ))}
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

        {isAuthenticated && followingDiaries.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-muted" />
              <h2 className="font-serif text-lg font-semibold text-foreground">
                From People You Follow
              </h2>
            </div>
            {followingDiaries.map((diary) => (
              <DiaryCard key={diary.id} diary={diary} />
            ))}
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

        {randomTags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
              Browse by Tags
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              {randomTags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/explore?tags=${tag}`}
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

        {randomEmotions.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
              Browse by Emotion
            </h2>
            <div className="flex gap-2 flex-wrap">
              {randomEmotions.map(({ emotion, count }) => (
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

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
            Browse by Year
          </h2>
          <div className="flex gap-2 flex-wrap">
            {Array.from(
              { length: new Date().getFullYear() - 2024 + 1 },
              (_, i) => 2024 + i
            )
              .reverse()
              .map((year) => (
                <Link
                  key={year}
                  href={`/explore?year=${year}`}
                  className="px-3 py-1 rounded text-xs border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-colors no-underline"
                >
                  {year}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
