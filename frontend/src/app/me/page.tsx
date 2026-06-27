"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { useAuthStore } from "@/store/auth-store";
import { useMyDiaries } from "@/hooks/use-diaries";
import { DiaryCard, type DiaryCardData } from "@/components/diary/diary-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function MyDiariesContent() {
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState("all");

  const privacy = filter === "all" ? undefined : filter;
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyDiaries(privacy);

  const allDiaries: DiaryCardData[] =
    data?.pages.flatMap((page) => page.data ?? []) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <div>
          <h1 className="font-serif text-xl font-semibold text-foreground">
            My Diaries
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {user?.username ? `Welcome back, ${user.username}` : ""}
          </p>
        </div>
        <Link href="/diary/new">
          <Button variant="primary" size="sm">
            Write
          </Button>
        </Link>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="private">Private</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="py-3 border-b border-border last:border-b-0 h-24 animate-pulse bg-overlay/5"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted">Couldn&apos;t load diaries.</p>
            </div>
          ) : allDiaries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted">
                No {filter === "all" ? "" : filter} diaries yet.
              </p>
              <Link
                href="/diary/new"
                className="inline-block mt-3 text-sm text-link hover:underline"
              >
                Write your first diary
              </Link>
            </div>
          ) : (
            <div>
              {allDiaries.map((diary) => (
                <DiaryCard key={diary.id} diary={diary} />
              ))}
              {hasNextPage && (
                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
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
