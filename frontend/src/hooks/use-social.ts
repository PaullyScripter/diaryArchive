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

async function fetchComments(diaryId: string, pageParam = 1) {
  const response = await apiClient.get(`/diaries/${diaryId}/comments`, {
    params: { page: pageParam, per_page: 50 },
  });
  return response.data;
}

async function createComment(diaryId: string, content: string, parentCommentId?: string) {
  const payload: Record<string, string> = { content };
  if (parentCommentId) payload.parent_comment_id = parentCommentId;
  const response = await apiClient.post(`/diaries/${diaryId}/comments`, payload);
  return response.data.data;
}

async function deleteComment(diaryId: string, commentId: string) {
  await apiClient.delete(`/diaries/${diaryId}/comments/${commentId}`);
}

async function toggleLike(diaryId: string) {
  const response = await apiClient.post(`/diaries/${diaryId}/like`);
  return response.data.data;
}

async function toggleBookmark(diaryId: string) {
  const response = await apiClient.post(`/diaries/${diaryId}/bookmark`);
  return response.data.data;
}

async function toggleFollow(username: string) {
  const response = await apiClient.post(`/users/${username}/follow`);
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

async function fetchReplies(commentId: string, pageParam = 1) {
  const response = await apiClient.get(`/comments/${commentId}/replies`, {
    params: { page: pageParam, per_page: 10 },
  });
  return response.data;
}

async function toggleCommentLike(commentId: string) {
  const response = await apiClient.post(`/comments/${commentId}/like`);
  return response.data.data;
}

export function useComments(diaryId: string) {
  return useInfiniteQuery({
    queryKey: ["comments", diaryId],
    queryFn: ({ pageParam }) => fetchComments(diaryId, pageParam as number),
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
    mutationFn: (commentId: string) => deleteComment(diaryId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", diaryId] });
      queryClient.invalidateQueries({ queryKey: ["replies"] });
      queryClient.invalidateQueries({ queryKey: ["diary", diaryId] });
    },
  });
}

export function useToggleLike(diaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => toggleLike(diaryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary", diaryId] });
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
    },
  });
}

export function useToggleBookmark(diaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => toggleBookmark(diaryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary", diaryId] });
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
    },
  });
}

export function useToggleFollow(username: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => toggleFollow(username),
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

export function useReplies(commentId: string) {
  return useInfiniteQuery({
    queryKey: ["replies", commentId],
    queryFn: ({ pageParam }) => fetchReplies(commentId, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: !!commentId,
  });
}

export function useToggleCommentLike(commentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => toggleCommentLike(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["replies"] });
    },
  });
}
