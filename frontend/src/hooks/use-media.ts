"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";

export interface MediaItem {
  id: string;
  user_id: string;
  diary_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  is_private: boolean;
  url: string;
  thumbnail_url?: string;
  standard_url?: string;
  created_at: string;
}

export function useMediaGallery(pageSize: number = 20) {
  return useInfiniteQuery({
    queryKey: ["media", "gallery"],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await apiClient.get("/media", {
        params: { page: pageParam, per_page: pageSize },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });
}

export function useMediaUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      diaryId,
      isPrivate,
      onProgress,
    }: {
      file: File;
      diaryId?: string;
      isPrivate?: boolean;
      onProgress?: (pct: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (diaryId) {
        formData.append("diary_id", diaryId);
      }
      if (isPrivate) {
        formData.append("is_private", "true");
      }

      const response = await apiClient.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });
      return response.data.data as MediaItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: () => {
      showToast("Failed to upload media. Please try again.");
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mediaId: string) => {
      await apiClient.delete(`/media/${mediaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      showToast("Media deleted.");
    },
    onError: () => {
      showToast("Failed to delete media.");
    },
  });
}

export function useMediaSignedUrl() {
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const response = await apiClient.get(`/media/${mediaId}/url`);
      return response.data.data as {
        url: string;
        id: string;
        mime_type: string;
        thumbnail_url?: string;
        standard_url?: string;
        expires_in_seconds: number;
      };
    },
  });
}
