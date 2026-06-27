"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface DiaryData {
  id: string;
  privacy: string;
  title: string | null;
  content_html: string | null;
  content_text: string | null;
  author: {
    id: string;
    username: string;
    avatar_path: string | null;
  };
  tags: string[];
  emotion: string | null;
  comments_enabled: boolean;
  comments_locked: boolean;
  stats: {
    like_count: number;
    comment_count: number;
    bookmark_count: number;
  };
  is_liked: boolean;
  is_bookmarked: boolean;
  is_owner: boolean;
  content_warnings: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface DiaryTagsResponse {
  tag: string;
  count: number;
}

export interface EmotionData {
  emotion: string;
  count: number;
}

async function fetchDiaries({
  pageParam = 1,
  sort = "latest",
  tags,
  emotion,
  year,
  month,
}: {
  pageParam?: number;
  sort?: string;
  tags?: string;
  emotion?: string;
  year?: number;
  month?: number;
}) {
  const params: Record<string, unknown> = {
    page: pageParam,
    per_page: 20,
    sort,
  };
  if (tags) params.tags = tags;
  if (emotion) params.emotion = emotion;
  if (year) params.year = year;
  if (month) params.month = month;

  const response = await apiClient.get("/diaries", { params });
  return response.data;
}

async function fetchDiary(id: string): Promise<DiaryData> {
  const response = await apiClient.get(`/diaries/${id}`);
  return response.data.data;
}

async function fetchMyDiaries({
  pageParam = 1,
  privacy,
}: {
  pageParam?: number;
  privacy?: string;
}) {
  const params: Record<string, unknown> = { page: pageParam, per_page: 20 };
  if (privacy) params.privacy = privacy;

  const response = await apiClient.get("/me/diaries", { params });
  return response.data;
}

async function fetchRandomDiary(): Promise<DiaryData> {
  const response = await apiClient.get("/diaries/random");
  return response.data.data;
}

async function fetchPopularTags(): Promise<DiaryTagsResponse[]> {
  const response = await apiClient.get("/tags/popular", { params: { limit: 100 } });
  return response.data.data;
}

async function fetchEmotions(): Promise<EmotionData[]> {
  const response = await apiClient.get("/emotions");
  return response.data.data;
}

async function createDiary(data: Record<string, unknown>) {
  const response = await apiClient.post("/diaries", data);
  return response.data.data;
}

async function updateDiary(id: string, data: Record<string, unknown>) {
  const response = await apiClient.put(`/diaries/${id}`, data);
  return response.data.data;
}

async function deleteDiary(id: string) {
  await apiClient.delete(`/diaries/${id}`);
}

export function useDiaries(filters?: {
  sort?: string;
  tags?: string;
  emotion?: string;
  year?: number;
  month?: number;
}) {
  return useInfiniteQuery({
    queryKey: ["diaries", filters],
    queryFn: ({ pageParam }) =>
      fetchDiaries({ pageParam: pageParam as number, ...filters }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
  });
}

export function useDiary(id: string) {
  return useQuery({
    queryKey: ["diary", id],
    queryFn: () => fetchDiary(id),
    enabled: !!id,
  });
}

export function useMyDiaries(privacy?: string) {
  return useInfiniteQuery({
    queryKey: ["myDiaries", privacy],
    queryFn: ({ pageParam }) =>
      fetchMyDiaries({ pageParam: pageParam as number, privacy }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
  });
}

export function useRandomDiary() {
  return useQuery({
    queryKey: ["randomDiary"],
    queryFn: fetchRandomDiary,
  });
}

export function usePopularTags() {
  return useQuery({
    queryKey: ["popularTags"],
    queryFn: fetchPopularTags,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmotions() {
  return useQuery({
    queryKey: ["emotions"],
    queryFn: fetchEmotions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDiary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
      queryClient.invalidateQueries({ queryKey: ["myDiaries"] });
    },
  });
}

export function useUpdateDiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown>) =>
      updateDiary(id as string, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["diary", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
      queryClient.invalidateQueries({ queryKey: ["myDiaries"] });
    },
  });
}

export function useDeleteDiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDiary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
      queryClient.invalidateQueries({ queryKey: ["myDiaries"] });
    },
  });
}
