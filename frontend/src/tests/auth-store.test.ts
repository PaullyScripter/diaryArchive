import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

describe("auth-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it("has correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("setUser updates user and auth state", () => {
    const user = { id: "123", username: "test", has_master_key: false } as any;
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("setAccessToken stores the token", () => {
    useAuthStore.getState().setAccessToken("token-abc");
    expect(useAuthStore.getState().accessToken).toBe("token-abc");
  });

  it("logout clears state and calls API", async () => {
    useAuthStore.setState({
      user: { id: "123", username: "test" } as any,
      accessToken: "token-abc",
      isAuthenticated: true,
    });
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

    await useAuthStore.getState().logout();

    expect(apiClient.post).toHaveBeenCalledWith("/auth/logout");
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("register sets access token on success", async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        data: { access_token: "new-token", id: "new-id", username: "newuser" },
      },
    });
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        data: { id: "new-id", username: "newuser", is_admin: false },
      },
    });

    await useAuthStore.getState().register("newuser", "Password1!");

    expect(useAuthStore.getState().accessToken).toBe("new-token");
  });
});
