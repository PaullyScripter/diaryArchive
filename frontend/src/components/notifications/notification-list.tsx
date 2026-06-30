"use client";

import type { NotificationItem as NotificationItemType } from "@/hooks/use-notifications";
import { NotificationItem } from "./notification-item";

function groupByDate(notifications: NotificationItemType[]): Record<string, NotificationItemType[]> {
  const groups: Record<string, NotificationItemType[]> = {};
  const now = new Date();

  for (const n of notifications) {
    const d = new Date(n.created_at);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    let key: string;
    if (diffDays === 0) key = "Today";
    else if (diffDays === 1) key = "Yesterday";
    else if (diffDays < 7) key = "This Week";
    else if (diffDays < 30) key = "This Month";
    else key = "Earlier";

    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  }

  return groups;
}

interface NotificationListProps {
  notifications: NotificationItemType[];
  onMarkRead: (id: string) => void;
}

export function NotificationList({ notifications, onMarkRead }: NotificationListProps) {
  const groups = groupByDate(notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([label, items]) => (
        <div key={label}>
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            {label}
          </h3>
          <div className="space-y-1">
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={onMarkRead}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
