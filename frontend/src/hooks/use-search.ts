"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useExploreStore, type SearchResult } from "@/store/explore-store";

interface SearchResponse {
  data: SearchResult[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    has_next: boolean;
    has_prev: boolean;
    processing_time_ms: number;
  };
}

async function fetchSearch({
  q = "",
  tags,
  emotion,
  year,
  month,
  sort = "created_at:desc",
  page = 1,
  perPage = 20,
}: {
  q?: string;
  tags?: string;
  emotion?: string | null;
  year?: number | null;
  month?: number | null;
  sort?: string;
  page?: number;
  perPage?: number;
}): Promise<SearchResponse> {
  const params: Record<string, unknown> = { page, per_page: perPage, sort };
  if (q) params.q = q;
  if (tags) params.tags = tags;
  if (emotion) params.emotion = emotion;
  if (year) params.year = year;
  if (month) params.month = month;

  const response = await apiClient.get("/search", { params });
  return response.data;
}

export function useSearchResults() {
  const query = useExploreStore((s) => s.query);
  const selectedTags = useExploreStore((s) => s.selectedTags);
  const selectedEmotion = useExploreStore((s) => s.selectedEmotion);
  const selectedYear = useExploreStore((s) => s.selectedYear);
  const selectedMonth = useExploreStore((s) => s.selectedMonth);
  const sort = useExploreStore((s) => s.sort);

  return useInfiniteQuery({
    queryKey: ["search", query, selectedTags, selectedEmotion, selectedYear, selectedMonth, sort],
    queryFn: ({ pageParam }) =>
      fetchSearch({
        q: query,
        tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
        emotion: selectedEmotion,
        year: selectedYear,
        month: selectedMonth,
        sort,
        page: pageParam as number,
        perPage: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: true,
  });
}
