"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { useAuthStore } from "@/store/auth-store";
import { useMyDiaries } from "@/hooks/use-diaries";
import { useMasterKey } from "@/hooks/use-master-key";
import { decryptDiary } from "@/lib/crypto";
import { DiaryCard, type DiaryCardData } from "@/components/diary/diary-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function MyDiariesContent() {
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState("all");
  const { masterKey, isAvailable: masterKeyAvailable } = useMasterKey();

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

  const [decryptedTitles, setDecryptedTitles] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!masterKey) return;
    const privateDiaries = allDiaries.filter(
      (d) => d.privacy === "private" && d.encrypted_data && !decryptedTitles[d.id]
    );
    if (privateDiaries.length === 0) return;

    const decryptAll = async () => {
      const updates: Record<string, string | null> = {};
      await Promise.all(
        privateDiaries.map(async (diary) => {
          try {
            const result = await decryptDiary(diary.encrypted_data!, masterKey);
            updates[diary.id] = result.title;
          } catch {
            updates[diary.id] = null;
          }
        })
      );
      setDecryptedTitles((prev) => ({ ...prev, ...updates }));
    };
    decryptAll();
  }, [allDiaries, masterKey, decryptedTitles]);

  const enrichedDiaries = allDiaries.map((diary) => {
    if (diary.privacy === "private" && decryptedTitles[diary.id] !== undefined) {
      return {
        ...diary,
        title: decryptedTitles[diary.id] ?? "Unable to decrypt",
      };
    }
    if (diary.privacy === "private" && !decryptedTitles[diary.id] && masterKeyAvailable) {
      return { ...diary, title: "Decrypting..." };
    }
    return diary;
  });

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
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
          ) : enrichedDiaries.length === 0 ? (
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
              <>
                {enrichedDiaries.map((diary) => (
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
              </>
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