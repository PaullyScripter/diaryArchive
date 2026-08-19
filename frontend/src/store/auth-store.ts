import { create } from "zustand";

import { apiClient } from "@/lib/api/client";
import { clearAllMasterKeys } from "@/lib/master-key-cache";

export interface User {
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
  is_admin: boolean;
  has_email: boolean;
  email_verified: boolean;
  has_master_key: boolean;
  preferences: {
    theme: string;
    comments_disabled: boolean;
    email_notifications: boolean;
    notify_on_like: boolean;
    notify_on_comment: boolean;
    notify_on_follow: boolean;
    notify_on_bookmark: boolean;
  };
  created_at: string;
  last_login_at: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBanned: boolean;
  banReason: string;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string, acceptedTerms?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  clearBan: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  isBanned: false,
  banReason: "",

  login: async (username: string, password: string) => {
    try {
      const response = await apiClient.post("/auth/login", { username, password });
      const data = response.data.data || response.data;
      set({
        accessToken: data.access_token,
        user: {
          id: data.id,
          username: data.username,
          avatar_path: null,
          about: null,
          favorite_quote: null,
          currently_feeling: null,
          stats: { diary_count: 0, follower_count: 0, following_count: 0 },
          is_admin: data.is_admin || false,
          has_email: false,
          email_verified: false,
          has_master_key: false,
          preferences: {
            theme: "system",
            comments_disabled: false,
            email_notifications: false,
            notify_on_like: true,
            notify_on_comment: true,
            notify_on_follow: true,
            notify_on_bookmark: false,
          },
          created_at: "",
          last_login_at: null,
        },
        isAuthenticated: true,
        isLoading: false,
        isBanned: false,
        banReason: "",
      });
      get().refreshAuth();
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "response" in err
      ) {
        const response = (err as { response: { status: number; data?: { error?: { code?: string; message?: string; data?: { ban_reason?: string; banned_at?: string; can_appeal?: boolean } } } } }).response;
        if (response.status === 403) {
          const errorBody = response.data?.error;
          if (errorBody?.code === "account_banned") {
            set({
              isBanned: true,
              banReason: errorBody.data?.ban_reason || errorBody.message || "Your account has been suspended.",
              isLoading: false,
            });
            return;
          }
        }
      }
      throw err;
    }
  },

  register: async (username: string, password: string, email?: string, acceptedTerms?: boolean) => {
    const response = await apiClient.post("/auth/register", {
      username,
      password,
      email: email || undefined,
      accepted_terms: !!acceptedTerms,
    });
    const data = response.data.data || response.data;
    set({
      accessToken: data.access_token,
      user: {
        id: data.id,
        username: data.username,
        avatar_path: null,
        about: null,
        favorite_quote: null,
        currently_feeling: null,
        stats: { diary_count: 0, follower_count: 0, following_count: 0 },
        is_admin: false,
        has_email: false,
        email_verified: false,
        has_master_key: false,
        preferences: {
          theme: "system",
          comments_disabled: false,
          email_notifications: false,
          notify_on_like: true,
          notify_on_comment: true,
          notify_on_follow: true,
          notify_on_bookmark: false,
        },
        created_at: data.created_at || "",
        last_login_at: null,
      },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    clearAllMasterKeys();
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore errors on logout
    }
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  refreshAuth: async () => {
    try {
      const response = await apiClient.post("/auth/refresh");
      const data = response.data.data || response.data;
      set({ accessToken: data.access_token });

      const meResponse = await apiClient.get("/auth/me");
      const meData = meResponse.data.data || meResponse.data;
      set({ user: meData, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: (user: User) => set({ user, isAuthenticated: true, isLoading: false }),

  setAccessToken: (token: string) => set({ accessToken: token }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  clearBan: () => set({ isBanned: false, banReason: "" }),
}));
