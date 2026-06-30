"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onToggle();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onToggle]);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="relative text-muted hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
        aria-label={unreadCount === 0 ? "Notifications" : `Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        type="button"
      >
        <BellIcon className="inline-block" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-destructive text-white text-[9px] font-semibold leading-none"
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
            role="dialog"
            aria-label="Notifications panel"
            aria-modal="true"
          />
          <div
            className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-md shadow-lg z-50 overflow-hidden"
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
            <div className="max-h-80 overflow-y-auto">
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
