"use client";

import { useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "@/components/notifications/notification-list";
import { useNotifications, type NotificationItem } from "@/hooks/use-notifications";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";

function NotificationDetail({ notification }: { notification: NotificationItem }) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirmBioChange = useCallback(async () => {
    setConfirming(true);
    try {
      await apiClient.put("/users/me/confirm-bio-change");
      showToast("Bio change confirmed");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to confirm";
      showToast(msg);
    } finally {
      setConfirming(false);
    }
  }, []);

  const handleConfirmUsernameChange = useCallback(async () => {
    setConfirming(true);
    try {
      await apiClient.put("/users/me/confirm-username-change");
      showToast("Username change confirmed");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        "Failed to confirm";
      showToast(msg);
    } finally {
      setConfirming(false);
    }
  }, []);

  return (
    <div className="border border-border p-4 bg-overlay">
      <h3 className="text-xs font-medium text-foreground mb-2">Notification Details</h3>
      <p className="text-sm text-foreground mb-1">{notification.message}</p>
      {notification.metadata?.body && (
        <pre className="text-xs text-subtle whitespace-pre-wrap font-sans leading-relaxed mb-3">
          {notification.metadata.body}
        </pre>
      )}
      {notification.type === "bio_warning" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleConfirmBioChange}
          disabled={confirming}
        >
          {confirming ? "Confirming..." : "I changed my bio"}
        </Button>
      )}
      {notification.type === "username_warning" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleConfirmUsernameChange}
          disabled={confirming}
        >
          {confirming ? "Confirming..." : "I changed my username"}
        </Button>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { list, unreadCount, markRead, markAllRead } = useNotifications();
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  const notifications = useMemo(
    () => list.data?.pages.flatMap((p) => p.data ?? []) ?? [],
    [list.data]
  );

  const total = list.data?.pages[0]?.meta?.total ?? 0;
  const unread = unreadCount.data?.data?.unread_count ?? 0;

  const handleMarkRead = useCallback(
    (id: string) => {
      markRead.mutate(id);
    },
    [markRead],
  );

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      if (notification.type === "bio_warning" || notification.type === "username_warning") {
        setSelectedNotification(notification);
      }
      if (!notification.read) {
        markRead.mutate(notification.id);
      }
    },
    [markRead],
  );

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground tracking-tight">
              Notifications
            </h1>
            <p className="text-sm text-muted mt-1">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <div className="flex items-center gap-2">
              {markAllRead.isError && (
                <span className="text-xs text-destructive">Failed - try again</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                {markAllRead.isPending ? "Marking..." : "Mark all as read"}
              </Button>
            </div>
          )}
        </div>

        {selectedNotification && (
          <div className="mb-4">
            <button
              onClick={() => setSelectedNotification(null)}
              className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0 mb-2"
            >
              &larr; Back to notifications
            </button>
            <NotificationDetail notification={selectedNotification} />
          </div>
        )}

        {list.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted mb-3">
              Could not load notifications.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => list.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-overlay border border-border mb-4">
              <svg
                className="w-8 h-8 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </div>
            <h2 className="text-lg font-serif font-semibold text-foreground mb-1">
              No notifications yet
            </h2>
            <p className="text-sm text-muted max-w-sm mx-auto mb-4">
              When someone likes your diary, comments on it, follows you, or
              bookmarks your entry, it will show up here.
            </p>
            <Link href="/explore">
              <Button variant="secondary" size="sm">
                Explore diaries
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div onClick={(e) => {
              const target = e.target as HTMLElement;
              const item = target.closest("[data-notification-id]") as HTMLElement | null;
              if (item) {
                const nId = item.dataset.notificationId;
                const n = notifications.find((x) => x.id === nId);
                if (n) handleNotificationClick(n);
              }
            }}>
              <NotificationList
                notifications={notifications}
                onMarkRead={handleMarkRead}
              />
            </div>
            {list.hasNextPage && (
              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => list.fetchNextPage()}
                  disabled={list.isFetchingNextPage}
                >
                  {list.isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
