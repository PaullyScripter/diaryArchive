"use client";

import type { NotificationItem as NotificationItemType } from "@/hooks/use-notifications";
import { NotificationItem } from "./notification-item";

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Earlier"];

function groupByDate(notifications: NotificationItemType[]): [string, NotificationItemType[]][] {
  const groups = new Map<string, NotificationItemType[]>();
  const now = new Date();

  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (isNaN(d.getTime())) continue;
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    let key: string;
    if (diffDays === 0) key = "Today";
    else if (diffDays === 1) key = "Yesterday";
    else if (diffDays < 7) key = "This Week";
    else if (diffDays < 30) key = "This Month";
    else key = "Earlier";

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  return GROUP_ORDER.filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!]);
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
      {groups.map(([label, items]) => (
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
