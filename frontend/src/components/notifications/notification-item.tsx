"use client";

import Link from "next/link";
import { Heart, MessageCircle, UserPlus, Bookmark } from "lucide-react";
import type { NotificationItem as NotificationItemType } from "@/hooks/use-notifications";

const ICON_MAP: Record<string, React.ReactNode> = {
  like: <Heart className="w-4 h-4 text-red-500" />,
  comment: <MessageCircle className="w-4 h-4 text-blue-500" />,
  follow: <UserPlus className="w-4 h-4 text-green-500" />,
  bookmark: <Bookmark className="w-4 h-4 text-amber-500" />,
};

function getTargetUrl(notification: NotificationItemType): string {
  switch (notification.type) {
    case "follow":
      return `/profile/${notification.actor_username}`;
    case "comment":
      return `/diary/${notification.target_id}`;
    case "like":
      return `/diary/${notification.target_id}`;
    case "bookmark":
      return `/diary/${notification.target_id}`;
    default:
      return "/notifications";
  }
}

interface NotificationItemProps {
  notification: NotificationItemType;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  };

  return (
    <Link
      href={getTargetUrl(notification)}
      onClick={handleClick}
      className={`flex items-start gap-3 px-3 py-2.5 -mx-3 rounded-sm transition-colors no-underline ${
        notification.read
          ? "hover:bg-overlay"
          : "bg-accent/5 border-l-2 border-l-accent hover:bg-accent/10"
      }`}
      role="button"
      aria-label={`${notification.read ? "" : "Unread: "}${notification.message}`}
    >
      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-overlay flex items-center justify-center border border-border">
        {ICON_MAP[notification.type] || ICON_MAP.like}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-snug ${
            notification.read ? "text-muted" : "text-foreground font-medium"
          }`}
        >
          {notification.message}
        </p>
        <p className="text-xs text-subtle mt-0.5">{notification.time_ago}</p>
      </div>
    </Link>
  );
}
