"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

export interface NotificationItem {
  id: string;
  type: "like" | "comment" | "follow" | "bookmark";
  actor_username: string;
  actor_avatar_path: string | null;
  message: string;
  target_id: string | null;
  target_type: string | null;
  read: boolean;
  created_at: string;
  time_ago: string;
  metadata: {
    diary_title?: string;
    comment_excerpt?: string;
    comment_id?: string;
    parent_content?: string;
  };
}

interface NotificationsResponse {
  data: NotificationItem[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    has_next: boolean;
    has_prev: boolean;
    unread_count: number;
  };
}

interface UnreadCountResponse {
  data: {
    unread_count: number;
  };
}

async function fetchNotifications({
  pageParam = 1,
  perPage = 20,
}: {
  pageParam?: number;
  perPage?: number;
}): Promise<NotificationsResponse> {
  const response = await apiClient.get("/notifications", {
    params: { page: pageParam, per_page: perPage },
  });
  return response.data;
}

async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  const response = await apiClient.get("/notifications/unread-count");
  return response.data;
}

async function markRead(notificationId: string): Promise<void> {
  await apiClient.put(`/notifications/${notificationId}/read`);
}

async function markAllRead(): Promise<void> {
  await apiClient.put("/notifications/read-all");
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const list = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) =>
      fetchNotifications({ pageParam: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_next ? lastPage.meta.page + 1 : undefined,
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  const unreadCount = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    list,
    unreadCount,
    markRead: markReadMutation,
    markAllRead: markAllReadMutation,
  };
}
