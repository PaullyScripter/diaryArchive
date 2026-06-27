"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { useAuthStore } from "@/store/auth-store";
import { useMyDiaries, useDeleteDiary } from "@/hooks/use-diaries";
import { DiaryCard, type DiaryCardData } from "@/components/diary/diary-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function MyDiariesContent() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const deleteDiary = useDeleteDiary();

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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this diary permanently?")) return;
    await deleteDiary.mutateAsync(id);
  };

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 border border-border rounded-lg h-48 animate-pulse bg-overlay/10"
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
              <p className="text-xs text-subtle mt-1">
                The blank page is waiting.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allDiaries.map((diary) => (
                  <div key={diary.id} className="relative group">
                    <Link
                      href={
                        diary.privacy === "private"
                          ? `/diary/${diary.id}`
                          : `/diary/${diary.id}`
                      }
                      className="block"
                    >
                      <DiaryCard diary={diary} />
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(diary.id);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-destructive hover:underline cursor-pointer bg-background/80 px-1 rounded"
                      title="Delete"
                    >
                      delete
                    </button>
                  </div>
                ))}
              </div>
              {hasNextPage && (
                <div className="mt-6 text-center">
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
