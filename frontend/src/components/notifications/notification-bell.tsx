"use client";

import Link from "next/link";
import { BellIcon } from "@/components/shared/icons";
import { NotificationItem } from "./notification-item";
import type { NotificationItem as NotificationItemType } from "@/hooks/use-notifications";

interface NotificationBellProps {
  unreadCount: number;
  recentNotifications: NotificationItemType[];
  isOpen: boolean;
  onToggle: () => void;
  onMarkRead: (id: string) => void;
}

export function NotificationBell({
  unreadCount,
  recentNotifications,
  isOpen,
  onToggle,
  onMarkRead,
}: NotificationBellProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="text-muted hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        type="button"
      >
        <BellIcon className="inline-block" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold leading-none"
            aria-live="polite"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={onToggle}
            onKeyDown={(e) => {
              if (e.key === "Escape") onToggle();
            }}
          />
          <div
            className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-md shadow-lg z-50"
            role="menu"
          >
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Notifications
              </span>
              <Link
                href="/notifications"
                className="text-xs text-link hover:underline no-underline"
                onClick={onToggle}
              >
                View all
              </Link>
            </div>
            <div className="max-h-80 overflow-y-auto px-1 py-1">
              {recentNotifications.length === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  No notifications yet.
                </p>
              ) : (
                recentNotifications.slice(0, 5).map((n) => (
                  <div key={n.id} onClick={onToggle} role="menuitem">
                    <NotificationItem
                      notification={n}
                      onMarkRead={onMarkRead}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
