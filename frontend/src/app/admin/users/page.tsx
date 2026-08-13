"use client";

import { useState } from "react";
import { useAdminUsers } from "@/hooks/use-admin";
import { showToast } from "@/components/shared/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [banReason, setBanReason] = useState("");
  const [banError, setBanError] = useState("");
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<string | null>(null);
  const { list, ban, unban, changeRole } = useAdminUsers(q, status);

  const users = list.data?.pages?.flatMap((p) => p.data ?? []) ?? [];

  const handleSearch = () => {
    setQ(searchInput.trim());
  };

  return (
    <div>
      <h1 className="text-sm font-medium mb-4">Users</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          <label htmlFor="admin-user-search" className="sr-only">
            Search username
          </label>
          <input
            id="admin-user-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search username..."
            className="text-xs border border-border bg-background text-foreground px-2 py-1 w-40"
          />
          <button
            onClick={handleSearch}
            className="text-xs px-2 py-1 border-0 cursor-pointer bg-foreground text-background"
          >
            Search
          </button>
          {q && (
            <button
              onClick={() => { setSearchInput(""); setQ(""); }}
              className="text-xs px-2 py-1 border-0 cursor-pointer bg-transparent text-muted hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {["all", "active", "banned"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs px-2 py-1 border-0 cursor-pointer ${
                status === s
                  ? "bg-foreground text-background"
                  : "bg-overlay text-muted hover:text-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {list.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {list.isError && (
        <div className="text-center py-12">
          <p className="text-sm text-muted mb-2">Failed to load users</p>
          <button
            onClick={() => list.refetch()}
            className="text-sm text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!list.isLoading && !list.isError && users.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No users found.</p>
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted">Username</th>
                <th className="py-2 pr-3 font-medium text-muted">Diaries</th>
                <th className="py-2 pr-3 font-medium text-muted">Status</th>
                <th className="py-2 pr-3 font-medium text-muted">Joined</th>
                <th className="py-2 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="py-2 pr-3">
                    <span className="text-foreground">
                      {u.username}
                      {u.is_admin && (
                        <span className="ml-1.5 text-[10px] text-accent font-medium">ADMIN</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted">{u.stats?.diary_count ?? 0}</td>
                  <td className="py-2 pr-3">
                    <span className={u.is_banned ? "text-destructive" : "text-link"}>
                      {u.is_banned ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted">{fmtDate(u.created_at)}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {!u.is_banned ? (
                        <button
                          onClick={() => setBanTarget(u.id)}
                          className="text-xs px-2 py-0.5 border-0 cursor-pointer bg-destructive text-white hover:opacity-80"
                        >
                          Ban
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            unban.mutate(u.id, {
                              onSuccess: () => showToast(`Unbanned ${u.username}`),
                              onError: (err: unknown) => {
                                const msg =
                                  (err as { response?: { data?: { error?: { message?: string } } } })
                                    ?.response?.data?.error?.message || "Failed to unban";
                                showToast(msg);
                              },
                            })
                          }
                          disabled={unban.isPending}
                          className="text-xs px-2 py-0.5 border border-border cursor-pointer bg-transparent text-link hover:text-foreground disabled:opacity-50"
                        >
                          Unban
                        </button>
                      )}
                      <button
                        onClick={() => setRoleTarget(u.id)}
                        className="text-xs px-2 py-0.5 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground"
                      >
                        {u.is_admin ? "Demote" : "Promote"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.hasNextPage && (
        <div className="mt-4 text-center">
          <button
            onClick={() => list.fetchNextPage()}
            className="text-xs text-link hover:text-link-hover cursor-pointer bg-transparent border-0 underline"
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      <Dialog open={!!banTarget} onOpenChange={(o) => { if (!o) { setBanTarget(null); setBanError(""); } }}>
        <DialogContent className="w-80 max-w-full">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              This will suspend the user&apos;s account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="ban-reason" className="text-xs text-muted block">
              Reason (min 10 characters)
            </label>
            <textarea
              id="ban-reason"
              value={banReason}
              onChange={(e) => { setBanReason(e.target.value); setBanError(""); }}
              rows={3}
              maxLength={1000}
              className="w-full border border-border bg-background text-xs p-2 text-foreground resize-none"
              placeholder="Explain the reason for this ban..."
            />
            {banError && (
              <p className="text-xs text-destructive" role="alert">{banError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" size="sm" onClick={() => { setBanTarget(null); setBanError(""); }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-destructive text-white border-destructive hover:opacity-80"
              onClick={() => {
                if (banReason.trim().length < 10) {
                  setBanError("Ban reason must be at least 10 characters");
                  return;
                }
                ban.mutate(
                  { id: banTarget!, reason: banReason.trim() },
                  {
                    onSuccess: () => {
                      showToast("User banned");
                      setBanTarget(null);
                      setBanReason("");
                      setBanError("");
                    },
                    onError: (err: unknown) => {
                      const msg =
                        (err as { response?: { data?: { error?: { message?: string } } } })
                          ?.response?.data?.error?.message || "Failed to ban";
                      showToast(msg);
                    },
                  },
                );
              }}
              disabled={ban.isPending}
            >
              {ban.isPending ? "Banning..." : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleTarget} onOpenChange={(o) => { if (!o) setRoleTarget(null); }}>
        <DialogContent className="w-72 max-w-full">
          <DialogHeader>
            <DialogTitle>
              {users.find((u) => u.id === roleTarget)?.is_admin
                ? "Demote from Admin"
                : "Promote to Admin"}
            </DialogTitle>
            <DialogDescription>
              {users.find((u) => u.id === roleTarget)?.is_admin
                ? "This will remove admin privileges from this user."
                : "This will grant full admin access to this user."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" size="sm" onClick={() => setRoleTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                const target = users.find((u) => u.id === roleTarget);
                changeRole.mutate(
                  {
                    id: roleTarget!,
                    isAdmin: target ? !target.is_admin : true,
                  },
                  {
                    onSuccess: () => {
                      showToast("Role updated");
                      setRoleTarget(null);
                    },
                    onError: (err: unknown) => {
                      const msg =
                        (err as { response?: { data?: { error?: { message?: string } } } })
                          ?.response?.data?.error?.message || "Failed to change role";
                      showToast(msg);
                    },
                  },
                );
              }}
              disabled={changeRole.isPending}
            >
              {changeRole.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
