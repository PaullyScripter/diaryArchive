"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

interface AdminStats {
  users: { total: number; banned: number; admins: number };
  diaries: { total: number; public: number; private: number };
  interactions: { comments: number; likes: number; bookmarks: number };
  reports: { pending: number };
  system: { timestamp: string };
}

interface AdminStatsResponse {
  data: AdminStats;
}

interface ServiceCheck {
  status: string;
  latency_ms: number;
  error?: string;
}

interface AdminHealth {
  status: string;
  checks: {
    mongodb?: ServiceCheck;
    redis?: ServiceCheck;
    meilisearch?: ServiceCheck;
  };
  timestamp: string;
}

interface AdminHealthResponse {
  data: AdminHealth;
}

interface Reporter {
  id: string;
  username: string;
}

interface TargetPreview {
  title?: string;
  author_username?: string;
  excerpt?: string | null;
  tags?: string[];
  content_deleted?: boolean;
  content?: string | null;
  diary_id?: string;
  username?: string;
  about?: string | null;
  is_banned?: boolean;
}

interface ReportItem {
  id: string;
  reporter: Reporter;
  target_type: string;
  target_id: string;
  target_preview: TargetPreview;
  reason: string;
  description: string | null;
  status: string;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface ReportsResponse {
  data: ReportItem[];
  meta: { page: number; per_page: number; total: number; has_next: boolean; has_prev: boolean };
}

interface AdminUserItem {
  id: string;
  username: string;
  avatar_path: string | null;
  is_admin: boolean;
  is_banned: boolean;
  stats: { diary_count: number; follower_count: number; following_count: number };
  created_at: string;
  last_login_at: string | null;
}

interface AdminUsersResponse {
  data: AdminUserItem[];
  meta: { page: number; per_page: number; total: number; has_next: boolean; has_prev: boolean };
}

interface AuditLogItem {
  id: string;
  admin_id: string;
  admin_username: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface AuditLogsResponse {
  data: AuditLogItem[];
  meta: { page: number; per_page: number; total: number; has_next: boolean; has_prev: boolean };
}

async function fetchAdminStats(): Promise<AdminStatsResponse> {
  const response = await apiClient.get("/admin/stats");
  return response.data;
}

async function fetchAdminHealth(): Promise<AdminHealthResponse> {
  const response = await apiClient.get("/admin/health");
  return response.data;
}

async function fetchReports(params: {
  pageParam?: number;
  status?: string;
}): Promise<ReportsResponse> {
  const response = await apiClient.get("/admin/reports", {
    params: { page: params.pageParam || 1, status: params.status || "pending" },
  });
  return response.data;
}

async function resolveReport(id: string, resolutionNote: string): Promise<void> {
  await apiClient.put(`/admin/reports/${id}`, {
    status: "resolved",
    resolution_note: resolutionNote,
  });
}

async function dismissReport(id: string): Promise<void> {
  await apiClient.put(`/admin/reports/${id}`, { status: "dismissed" });
}

async function fetchAdminUsers(params: {
  pageParam?: number;
  q?: string;
  status?: string;
}): Promise<AdminUsersResponse> {
  const response = await apiClient.get("/admin/users", {
    params: {
      page: params.pageParam || 1,
      q: params.q || undefined,
      status: params.status || "all",
    },
  });
  return response.data;
}

async function banUser(userId: string, reason: string): Promise<void> {
  await apiClient.put(`/admin/users/${userId}/ban`, { is_banned: true, reason });
}

async function unbanUser(userId: string): Promise<void> {
  await apiClient.put(`/admin/users/${userId}/ban`, { is_banned: false });
}

async function changeUserRole(userId: string, isAdmin: boolean): Promise<void> {
  await apiClient.put(`/admin/users/${userId}/role`, { is_admin: isAdmin });
}

async function fetchAuditLogs(params: {
  pageParam?: number;
  action?: string;
  admin_id?: string;
  from_date?: string;
  to_date?: string;
}): Promise<AuditLogsResponse> {
  const response = await apiClient.get("/admin/audit-logs", {
    params: {
      page: params.pageParam || 1,
      action: params.action || undefined,
      admin_id: params.admin_id || undefined,
      from_date: params.from_date || undefined,
      to_date: params.to_date || undefined,
    },
  });
  return response.data;
}

export function useAdminStats() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    staleTime: 300_000,
    enabled: isAuthenticated,
  });
}

export function useAdminHealth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["admin", "health"],
    queryFn: fetchAdminHealth,
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  });
}

export function useAdminReports(status: string = "pending") {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const list = useInfiniteQuery({
    queryKey: ["admin", "reports", status],
    queryFn: ({ pageParam }) =>
      fetchReports({ pageParam: pageParam as number, status }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: isAuthenticated,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
  };

  const resolveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => resolveReport(id, note),
    onSuccess: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissReport(id),
    onSuccess: invalidate,
  });

  return { list, resolve: resolveMutation, dismiss: dismissMutation };
}

export function useAdminUsers(q: string = "", status: string = "all") {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const list = useInfiniteQuery({
    queryKey: ["admin", "users", q, status],
    queryFn: ({ pageParam }) =>
      fetchAdminUsers({ pageParam: pageParam as number, q, status }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: isAuthenticated,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
  };

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => banUser(id, reason),
    onSuccess: invalidate,
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => unbanUser(id),
    onSuccess: invalidate,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
      changeUserRole(id, isAdmin),
    onSuccess: invalidate,
  });

  return {
    list,
    ban: banMutation,
    unban: unbanMutation,
    changeRole: roleMutation,
  };
}

export function useAdminAuditLogs(filters: {
  action?: string;
  from_date?: string;
  to_date?: string;
} = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const list = useInfiniteQuery({
    queryKey: ["admin", "audit-logs", filters],
    queryFn: ({ pageParam }) =>
      fetchAuditLogs({
        pageParam: pageParam as number,
        ...filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_next ? lastPage.meta.page + 1 : undefined,
    enabled: isAuthenticated,
  });

  return { list };
}
