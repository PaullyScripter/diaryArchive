"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface UserProfile {
  id: string;
  username: string;
  avatar_path: string | null;
  about: string | null;
  favorite_quote: string | null;
  currently_feeling: string | null;
  stats: {
    diary_count: number;
    follower_count: number;
    following_count: number;
  };
  created_at: string;
  is_following: boolean;
}

export interface DiaryEntry {
  id: string;
  title: string | null;
  excerpt: string | null;
  tags: string[];
  emotion: string | null;
  stats: {
    like_count: number;
    comment_count: number;
    bookmark_count: number;
  };
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

async function fetchProfile(username: string): Promise<UserProfile> {
  const response = await apiClient.get(`/users/${username}`);
  return response.data.data;
}

async function fetchUserDiaries(
  username: string,
  page: number,
): Promise<{ entries: DiaryEntry[]; meta: { total: number; has_next: boolean } }> {
  const response = await apiClient.get(`/users/${username}/diaries`, {
    params: { page, per_page: 20 },
  });
  return { entries: response.data.data, meta: response.data.meta };
}

async function updateProfile(data: Record<string, unknown>): Promise<UserProfile> {
  const response = await apiClient.put("/users/me", data);
  return response.data.data;
}

async function updateEmail(email: string | null): Promise<{
  has_email: boolean;
  email_verified: boolean;
  message: string;
}> {
  const response = await apiClient.put("/users/me/email", { email });
  return response.data.data;
}

export function useUserProfile(username: string) {
  return useQuery({
    queryKey: ["user", username],
    queryFn: () => fetchProfile(username),
    enabled: !!username,
  });
}

export function useUserDiaries(username: string, page: number = 1) {
  return useQuery({
    queryKey: ["userDiaries", username, page],
    queryFn: () => fetchUserDiaries(username, page),
    enabled: !!username,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useUpdateEmail() {
  return useMutation({
    mutationFn: updateEmail,
  });
}
