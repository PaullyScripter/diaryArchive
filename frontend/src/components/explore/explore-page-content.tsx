"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useExploreStore } from "@/store/explore-store";
import { useSearchResults } from "@/hooks/use-search";
import { usePopularTags, useEmotions } from "@/hooks/use-diaries";
import { SearchBar } from "@/components/explore/search-bar";
import { TagCloud } from "@/components/explore/tag-cloud";
import { EmotionBrowser } from "@/components/explore/emotion-browser";
import { DateArchive } from "@/components/explore/date-archive";
import { ActiveFilters } from "@/components/explore/active-filters";
import { SearchResults } from "@/components/explore/search-results";

export function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useExploreStore();
  const { data: tagsData } = usePopularTags();
  const { data: emotionsResponse } = useEmotions();

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const tags = searchParams.get("tags") || "";
    const emotion = searchParams.get("emotion") || "";
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (q !== store.query) store.setQuery(q);
    if (tags) {
      const tagArr = tags.split(",").filter(Boolean);
      const existing = new Set(store.selectedTags);
      for (const t of store.selectedTags) {
        if (!tagArr.includes(t)) store.toggleTag(t);
      }
      for (const t of tagArr) {
        if (!existing.has(t)) store.toggleTag(t);
      }
    } else if (store.selectedTags.length > 0) {
      for (const t of [...store.selectedTags]) store.toggleTag(t);
    }
    if (emotion !== (store.selectedEmotion || "")) {
      store.setEmotion(emotion || null);
    }
    if (year && parseInt(year) !== (store.selectedYear || 0)) {
      store.setDate(parseInt(year), month ? parseInt(month) : null);
    }
  }, [searchParams]);

  const updateUrl = () => {
    const params = new URLSearchParams();
    if (store.query) params.set("q", store.query);
    if (store.selectedTags.length > 0) params.set("tags", store.selectedTags.join(","));
    if (store.selectedEmotion) params.set("emotion", store.selectedEmotion);
    if (store.selectedYear) {
      params.set("year", String(store.selectedYear));
      if (store.selectedMonth) params.set("month", String(store.selectedMonth));
    }
    const qs = params.toString();
    router.push(`/explore${qs ? "?" + qs : ""}`, { scroll: false });
  };

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchResults();

  const diaries = useMemo(
    () => data?.pages.flatMap((p) => p.data ?? []) ?? [],
    [data]
  );
  const total = data?.pages[0]?.meta?.total ?? 0;

  const allTags = tagsData ?? [];
  const allEmotions = emotionsResponse?.data ?? [];
  const totalDiaries = emotionsResponse?.total ?? 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6 sticky top-0 z-10 bg-background pt-2 pb-3">
        <SearchBar
          value={store.query}
          onChange={(q) => {
            store.setQuery(q);
            updateUrl();
          }}
          isLoading={isLoading}
        />
      </div>

      <section className="mb-6">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Tags
        </h2>
        <TagCloud
          tags={allTags}
          selectedTags={store.selectedTags}
          onToggleTag={(tag) => {
            store.toggleTag(tag);
            updateUrl();
          }}
        />
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Emotions
        </h2>
        <EmotionBrowser
          emotions={allEmotions}
          totalCount={totalDiaries}
          selectedEmotion={store.selectedEmotion}
          onSelectEmotion={(emotion) => {
            store.setEmotion(emotion);
            updateUrl();
          }}
        />
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Browse by Date
        </h2>
        <DateArchive
          selectedYear={store.selectedYear}
          selectedMonth={store.selectedMonth}
          onSelectDate={(year, month) => {
            store.setDate(year, month);
            updateUrl();
          }}
        />
      </section>

      <ActiveFilters
        tags={store.selectedTags}
        emotion={store.selectedEmotion}
        year={store.selectedYear}
        month={store.selectedMonth}
        onRemoveTag={(tag) => {
          store.toggleTag(tag);
          updateUrl();
        }}
        onRemoveEmotion={() => {
          store.setEmotion(null);
          updateUrl();
        }}
        onRemoveDate={() => {
          store.setDate(null, null);
          updateUrl();
        }}
        onClearAll={() => {
          store.clearFilters();
          updateUrl();
        }}
      />

      <div className="mt-4">
        <SearchResults
          diaries={diaries}
          isLoading={isLoading}
          isError={isError}
          error={error}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={!!hasNextPage}
          total={total}
          onLoadMore={() => fetchNextPage()}
        />
      </div>
    </div>
  );
}
