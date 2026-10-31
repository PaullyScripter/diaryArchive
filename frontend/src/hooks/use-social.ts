"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface CommentData {
  id: string;
  content: string | null;
  author: {
    id: string;
    username: string;
    avatar_path: string | null;
    is_admin?: boolean;
    badges?: { type: string; tier: string; label: string; color: string; icon: string; shine?: boolean }[];
  };
  is_deleted: boolean;
  is_owner: boolean;
  is_diary_owner: boolean;
  parent_comment_id: string | null;
  depth: number;
  reply_count: number;
  like_count: number;
  is_liked: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ToggleResult {
  is_liked?: boolean;
  is_bookmarked?: boolean;
  is_following?: boolean;
  like_count?: number;
  bookmark_count?: number;
  follower_count?: number;
}

export interface UserListItem {
  id: string;
  username: string;
  avatar_path: string | null;
  about: string | null;
  is_following: boolean;
}

async function fetchComments(diaryId: string, pageParam = 1, highlightId?: string | null) {
  const response = await apiClient.get(`/diaries/${diaryId}/comments`, {
    params: { page: pageParam, per_page: 50, highlight_id: pageParam === 1 ? highlightId : undefined },
  });
  return response.data;
}

async function createComment(diaryId: string, content: string, parentCommentId?: string) {
  const payload: Record<string, string> = { content };
  if (parentCommentId) payload.parent_comment_id = parentCommentId;
  const response = await apiClient.post(`/diaries/${diaryId}/comments`, payload);
  return response.data.data;
}

async function deleteComment(diaryId: string, commentId: string, adminDeleteReason?: string) {
  const payload = adminDeleteReason ? { admin_delete_reason: adminDeleteReason } : undefined;
  await apiClient.delete(`/diaries/${diaryId}/comments/${commentId}`, { data: payload });
}

async function setLike(diaryId: string, active: boolean) {
  const response = await apiClient.put(`/diaries/${diaryId}/like`, { active });
  return response.data.data;
}

async function setBookmark(diaryId: string, active: boolean) {
  const response = await apiClient.put(`/diaries/${diaryId}/bookmark`, { active });
  return response.data.data;
}

async function setFollow(username: string, active: boolean) {
  const response = await apiClient.put(`/users/${username}/follow`, { active });
  return response.data.data;
}

async function fetchMyLikes(pageParam = 1) {
  const response = await apiClient.get("/me/likes", {
    params: { page: pageParam, per_page: 20 },
  });
  return response.data;
}

async function fetchMyBookmarks(pageParam = 1) {
  const response = await apiClient.get("/me/bookmarks", {
    params: { page: pageParam, per_page: 20 },
  });
  return response.data;
}

async function fetchFollowers(username: string, pageParam = 1) {
  const response = await apiClient.get(`/users/${username}/followers`, {
    params: { page: pageParam, per_page: 20 },
  });
  return response.data;
}

async function fetchFollowing(username: string, pageParam = 1) {
  const response = await apiClient.get(`/users/${username}/following`, {
    params: { page: pageParam, per_page: 20 },
  });
  return response.data;
}

async function fetchReplies(commentId: string, pageParam = 1, highlightId?: string | null) {
  const response = await apiClient.get(`/comments/${commentId}/replies`, {
    params: { page: pageParam, per_page: 10, highlight_id: pageParam === 1 ? highlightId : undefined },
  });
  return response.data;
}

async function setCommentLike(commentId: string, active: boolean) {
  const response = await apiClient.put(`/comments/${commentId}/like`, { active });
  return response.data.data;
}

export function useComments(diaryId: string, highlightId?: string | null) {
  return useInfiniteQuery({
    queryKey: ["comments", diaryId, highlightId ?? null],
    queryFn: ({ pageParam }) => fetchComments(diaryId, pageParam as number, highlightId),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: !!diaryId,
  });
}

export function useCreateComment(diaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      createComment(diaryId, content, parentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", diaryId] });
      if (variables.parentId) {
        queryClient.invalidateQueries({ queryKey: ["replies", variables.parentId] });
      }
      queryClient.invalidateQueries({ queryKey: ["diary", diaryId] });
    },
  });
}

export function useDeleteComment(diaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, reason }: { commentId: string; reason?: string }) =>
      deleteComment(diaryId, commentId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", diaryId] });
      queryClient.invalidateQueries({ queryKey: ["replies"] });
      queryClient.invalidateQueries({ queryKey: ["diary", diaryId] });
      queryClient.invalidateQueries({ queryKey: ["followingFeed"] });
    },
  });
}

export function useToggleLike(diaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => setLike(diaryId, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary", diaryId] });
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
    },
  });
}

export function useToggleBookmark(diaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => setBookmark(diaryId, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary", diaryId] });
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
    },
  });
}

export function useToggleFollow(username: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => setFollow(username, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", username] });
      queryClient.invalidateQueries({ queryKey: ["followers", username] });
      queryClient.invalidateQueries({ queryKey: ["following", username] });
    },
  });
}

export function useMyLikes() {
  return useInfiniteQuery({
    queryKey: ["myLikes"],
    queryFn: ({ pageParam }) => fetchMyLikes(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
  });
}

export function useMyBookmarks() {
  return useInfiniteQuery({
    queryKey: ["myBookmarks"],
    queryFn: ({ pageParam }) => fetchMyBookmarks(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
  });
}

export function useFollowers(username: string) {
  return useInfiniteQuery({
    queryKey: ["followers", username],
    queryFn: ({ pageParam }) => fetchFollowers(username, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: !!username,
  });
}

export function useFollowing(username: string) {
  return useInfiniteQuery({
    queryKey: ["following", username],
    queryFn: ({ pageParam }) => fetchFollowing(username, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: !!username,
  });
}

export function useReplies(commentId: string, highlightId?: string | null) {
  return useInfiniteQuery({
    queryKey: ["replies", commentId, highlightId ?? null],
    queryFn: ({ pageParam }) => fetchReplies(commentId, pageParam as number, highlightId),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: !!commentId,
  });
}

export function useToggleCommentLike(commentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => setCommentLike(commentId, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["replies"] });
    },
  });
}

async function fetchFollowingFeed() {
  const response = await apiClient.get("/me/following/feed");
  return response.data;
}

export function useFollowingFeed() {
  return useQuery({
    queryKey: ["followingFeed"],
    queryFn: fetchFollowingFeed,
    staleTime: 60 * 1000,
  });
}
