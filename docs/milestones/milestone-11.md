# Milestone 11 — Notifications

## Overview

**Goal:** Users receive notifications when someone interacts with their content — likes, comments, follows, and bookmarks. A notification center provides a centralized inbox, and a live bell icon shows unread counts.

**Purpose:** Notifications are the engagement loop of DiaryArchive. Without them, users must manually check their content for reactions. Notifications drive re-engagement, inform users of community activity, and build the social feedback loop that transforms a content platform into a community.

**Dependencies:** Milestone 09 (Likes, Bookmarks, Comments), Milestone 04 (Authentication), Milestone 05 (User Profiles)

---

## Architecture Impact

### Backend
- New `notifications` collection in MongoDB with TTL index for 90-day auto-cleanup
- Notification creation service called by existing like/comment/follow/bookmark services
- GET endpoints for listing notifications (paginated, unread-first), unread count
- PUT endpoints for marking single/all as read
- Notification preference checks before creation (respect user's `notify_on_like`, etc. toggles)
- Self-action filter: don't notify user of their own actions
- Lightweight, fast unread-count endpoint (uses MongoDB count with index, cached briefly)
- Real-time via polling (WebSocket in M14)

### Frontend
- Notification center page (`/notifications`) with date-grouped list
- Notification item component (icon, message, timestamp, read/unread styling)
- Notification bell in NavBar with live unread count badge
- Mark-as-read on click (navigates to target and marks read)
- Mark-all-read button in notification center
- Polling every 30 seconds via TanStack Query `refetchInterval`
- Empty state for first-time users
- Unread badge integrated into NavBar

### Database
- New `notifications` collection
- TTL index on `created_at` (90 days)
- Compound indexes for listing (user_id + created_at + is_read) and unread count (user_id + is_read)

### API
- 4 new endpoints: list, unread count, mark read, mark all read
- All use standard `{ data: { ... } }` envelope

### Security
- Users can only see their own notifications (enforced by `user_id` filter from JWT)
- Self-action filter prevents notification spam
- Notification preference toggles respected server-side
- No sensitive content in notification messages

---

## Features

### F11.1 — Notification Schema (Backend)

**File:** `backend/app/models/notification.py`

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal
from bson import ObjectId

class NotificationType:
    LIKE = "like"
    COMMENT = "comment"
    FOLLOW = "follow"
    BOOKMARK = "bookmark"
    # Future: MENTION = "mention", SYSTEM = "system"

class NotificationCreate(BaseModel):
    user_id: str  # Recipient user ID
    actor_id: str  # User who performed the action
    type: Literal["like", "comment", "follow", "bookmark"]
    target_id: str | None = None  # Diary ID (for like/comment/bookmark)
    target_type: Literal["diary", "comment", "user"] | None = None
    message: str  # Human-readable summary, e.g. "moonwriter liked your diary"
    metadata: dict = {}  # Extra data: diary_title, comment_excerpt, etc.
```

### F11.2 — Notification Creation Service (Backend)

**File:** `backend/app/services/notification_service.py`

Service called by like/comment/follow/bookmark services after an action is performed.

```python
class NotificationService:
    def __init__(self, db):
        self.collection = db.notifications

    async def create_notification(
        self,
        recipient_id: str,
        actor_id: str,
        notification_type: str,
        target_id: str | None = None,
        target_type: str | None = None,
        metadata: dict | None = None,
    ) -> str | None:
        """Create a notification if preferences allow and actor != recipient."""

        # 1. Self-action filter: don't notify for own actions
        if recipient_id == actor_id:
            return None

        # 2. Check notification preferences
        recipient = await self._get_user(recipient_id)
        prefs = recipient.get("preferences", {})
        pref_key = f"notify_on_{notification_type}"
        if not prefs.get(pref_key, True):
            return None

        # 3. Check if recipient has email notifications disabled (skip email for MVP)
        # (Email notifications deferred to future milestone)

        # 4. Build message
        actor = await self._get_user(actor_id)
        actor_username = actor.get("username", "someone")
        message = self._build_message(notification_type, actor_username, metadata)
        target_type_map = {
            "like": "diary",
            "comment": "comment",
            "follow": "user",
            "bookmark": "diary",
        }

        # 5. Create notification document
        doc = {
            "user_id": ObjectId(recipient_id),
            "actor_id": ObjectId(actor_id),
            "actor_username": actor_username,
            "type": notification_type,
            "target_id": ObjectId(target_id) if target_id else None,
            "target_type": target_type_map.get(notification_type),
            "message": message,
            "metadata": metadata or {},
            "is_read": False,
            "created_at": datetime.utcnow(),
        }
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)

    def _build_message(self, notification_type: str, username: str, metadata: dict | None) -> str:
        messages = {
            "like": f"{username} liked your diary",
            "comment": f"{username} commented on your diary",
            "follow": f"{username} started following you",
            "bookmark": f"{username} bookmarked your diary",
        }
        msg = messages.get(notification_type, f"{username} interacted with your content")
        if metadata and metadata.get("diary_title"):
            msg += f" \"{metadata['diary_title'][:50]}\""
        if notification_type == "comment" and metadata and metadata.get("comment_excerpt"):
            msg += f": \"{metadata['comment_excerpt'][:80]}\""
        return msg
```

### F11.3 — Notification Creation Hooks (Backend)

**Files modified:** `backend/app/services/like_service.py`, `comment_service.py`, `follow_service.py`, `bookmark_service.py`

Each service calls `NotificationService.create_notification` after successful action (and before cascade on delete).

**Like (in like_service.py, after successful like insert):**
```python
await notification_service.create_notification(
    recipient_id=diary_owner_id,
    actor_id=current_user_id,
    notification_type="like",
    target_id=diary_id,
    metadata={"diary_title": diary_title},
)
```

**Comment (in comment_service.py, after successful comment insert):**
```python
await notification_service.create_notification(
    recipient_id=diary_owner_id,
    actor_id=current_user_id,
    notification_type="comment",
    target_id=comment_id,
    metadata={"diary_title": diary_title, "comment_excerpt": content_text[:100]},
)
```

**Follow (in follow_service.py, after follow relationship created):**
```python
await notification_service.create_notification(
    recipient_id=target_user_id,
    actor_id=current_user_id,
    notification_type="follow",
    target_id=target_user_id,
    target_type="user",
)
```

**Bookmark (in bookmark_service.py, after bookmark created):**
```python
await notification_service.create_notification(
    recipient_id=diary_owner_id,
    actor_id=current_user_id,
    notification_type="bookmark",
    target_id=diary_id,
    metadata={"diary_title": diary_title},
)
```

### F11.4 — Notification List Endpoint (Backend)

**File:** `backend/app/api/v1/endpoints/notifications.py`

**F11.4.1 — GET /api/v1/notifications**

Paginated list of notifications for the current user, sorted unread-first, then by most recent.

- Auth: Bearer access token required
- Query: `page` (default 1), `per_page` (default 20, max 50)
- Sorts: `is_read: 1` (unread first), `created_at: -1` (newest first)
- Response:

```json
{
  "data": [
    {
      "id": "667a1b2c3d4e5f6a7b8c9d0e",
      "type": "like",
      "actor_username": "moonwriter",
      "actor_avatar_path": null,
      "message": "moonwriter liked your diary \"A Walk in the Rain\"",
      "target_id": "665a2b3c...",
      "target_type": "diary",
      "is_read": false,
      "created_at": "2026-06-25T08:30:00Z",
      "time_ago": "2 hours ago"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 43,
    "has_next": true,
    "has_prev": false,
    "unread_count": 5
  }
}
```

```python
async def get_notifications(
    page: int = 1,
    per_page: int = 20,
    current_user: dict = Depends(get_current_user),
):
    query = {"user_id": ObjectId(current_user["_id"])}
    sort = [("is_read", 1), ("created_at", -1)]
    skip = (page - 1) * per_page

    cursor = db.notifications.find(query).sort(sort).skip(skip).limit(per_page)
    notifications = await cursor.to_list(per_page)

    total = await db.notifications.count_documents(query)
    unread = await db.notifications.count_documents(
        {"user_id": ObjectId(current_user["_id"]), "is_read": False}
    )

    return {
        "data": [format_notification(n) for n in notifications],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": skip + per_page < total,
            "has_prev": page > 1,
            "unread_count": unread,
        },
    }
```

### F11.5 — Unread Count Endpoint (Backend)

**F11.5.1 — GET /api/v1/notifications/unread-count**

Fast endpoint optimized for the NavBar badge. Returns only the count.

- Auth: Bearer access token required
- No pagination, no sorting, no enrichment
- Response: `{ "data": { "unread_count": 5 } }`
- Implementation: `db.notifications.count_documents({"user_id": ..., "is_read": False})`
- Cache: Optional Redis cache with 10-second TTL (reduces load on high-frequency polling)

### F11.6 — Mark Read Endpoints (Backend)

**F11.6.1 — PUT /api/v1/notifications/{id}/read**

Mark a single notification as read.

- Auth: Bearer access token required
- Authorization: notification must belong to the requesting user (return 404 if not found or not owned)
- Response 200: `{ "data": { "message": "Notification marked as read" } }`
- Logic: `db.notifications.update_one({"_id": ObjectId(id), "user_id": current_user_id}, {"$set": {"is_read": True}})`

**F11.6.2 — PUT /api/v1/notifications/read-all**

Mark all notifications as read for the current user.

- Auth: Bearer access token required
- Response 200: `{ "data": { "message": "All notifications marked as read", "count": 12 } }`
- Logic: `result = await db.notifications.update_many({"user_id": ..., "is_read": False}, {"$set": {"is_read": True}})`
- Returns count of updated documents

### F11.7 — Notification Cleanup (Backend)

**File:** `backend/app/db/indexes.py` (modified)

TTL index on `notifications.created_at` — automatically deletes documents older than 90 days.

```python
await db.notifications.create_index(
    "created_at",
    expireAfterSeconds=60 * 60 * 24 * 90,  # 90 days
    name="notifications_ttl",
)
```

In addition, add compound indexes for query performance:

```python
await db.notifications.create_index(
    [("user_id", 1), ("is_read", 1), ("created_at", -1)],
    name="notifications_user_list",
)
await db.notifications.create_index(
    [("user_id", 1), ("is_read", 1)],
    name="notifications_unread_count",
)
```

### F11.8 — Notification Center Page (Frontend)

**File:** `frontend/src/app/(main)/notifications/page.tsx`

A dedicated page listing all notifications, grouped by date.

```
┌────────────────────────────────────────┐
│  Notifications                         │
│  [Mark all as read]  (12 unread)       │
│  ────────────────────────────────────── │
│                                        │
│  Today                                 │
│  ────────────────────────────────────── │
│  ❤️ moonwriter liked your diary        │
│     "A Walk in the Rain"  ·  2h ago    │
│  ────────────────────────────────────── │
│  💬 starry_night commented on your     │
│     diary "Midnight Thoughts"          │
│     "beautifully written"  ·  5h ago   │
│  ────────────────────────────────────── │
│                                        │
│  Yesterday                              │
│  ────────────────────────────────────── │
│  🔖 wanderlust bookmarked your diary   │
│     "Tokyo Dreams"  ·  1d ago          │
│  ────────────────────────────────────── │
│  ➕ quiet_soul started following you    │
│     ·  1d ago                          │
│                                        │
│  [Load More]                           │
└────────────────────────────────────────┘
```

**States:**
- **Loading:** Skeleton list of notification items (repeat placeholder 5x)
- **Empty:** "No notifications yet. When someone likes, comments, follows, or bookmarks your content, it will show up here."
- **Error:** "Couldn't load notifications" with retry button
- **Has data:** Date-grouped list with read/unread visual distinction

### F11.9 — Notification Item Component (Frontend)

**File:** `frontend/src/components/notifications/notification-item.tsx`

```tsx
interface NotificationItemProps {
  notification: {
    id: string;
    type: "like" | "comment" | "follow" | "bookmark";
    actor_username: string;
    actor_avatar_path: string | null;
    message: string;
    target_id: string | null;
    target_type: string | null;
    is_read: boolean;
    created_at: string;
    time_ago: string;
  };
  onMarkRead: (id: string) => void;
  onClick: (notification: Notification) => void;
}
```

- **Visual structure:**
  - Left: Type icon (❤️ like, 💬 comment, ➕ follow, 🔖 bookmark) in a circle
  - Middle: Actor avatar (small, 32px) + message text
  - Right: Timestamp (`time_ago`)
  - Background: slightly tinted if unread (primary-light/10), white if read
  - Left border: accent color if unread, transparent if read

- **onClick behavior:**
  - Mark as read (optimistic update)
  - Navigate to target:
    - `like` → `/diary/{target_id}`
    - `comment` → `/diary/{target_id}#comment-{metadata.comment_id}`
    - `follow` → `/profile/{actor_username}`
    - `bookmark` → `/diary/{target_id}`

- **States:** default, hover (subtle background change), read (faded styling)

### F11.10 — Notification Bell Component (Frontend)

**File:** `frontend/src/components/notifications/notification-bell.tsx`

```tsx
interface NotificationBellProps {
  unreadCount: number;
  isOpen: boolean;
  onToggle: () => void;
}
```

- Bell icon (🔔 or SVG) with unread count badge
- Badge: red circle with white number, positioned top-right of bell
- Shows count up to 99 (`99+` for ≥100)
- Hidden when count is 0
- Click opens a dropdown mini-list of recent notifications (last 5), with "View all" link to `/notifications`
- Dropdown items same as `NotificationItem` but compact

### F11.11 — Mark-as-Read Flow (Frontend)

- Clicking a notification item on `/notifications` or in the bell dropdown:
  1. Optimistically mark the notification as read in local state
  2. Call `PUT /api/v1/notifications/{id}/read`
  3. Navigate to the target URL
  4. On error, revert to unread state

- "Mark all as read" button:
  1. Optimistically mark all as read in local state
  2. Call `PUT /api/v1/notifications/read-all`
  3. On success, update unread count to 0
  4. On error, revert

### F11.12 — Notification Polling (Frontend)

**File:** `frontend/src/hooks/use-notifications.ts`

```typescript
export function useNotifications() {
  // List endpoint with 30-second polling
  const list = useQuery({
    queryKey: ["notifications", page],
    queryFn: () => api.get(`/notifications?page=${page}&per_page=20`),
    refetchInterval: 30_000, // Poll every 30 seconds
  });

  // Unread count with 30-second polling (separate query for fast badge)
  const unreadCount = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get("/notifications/unread-count"),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return { list, unreadCount, markRead, markAllRead };
}
```

### F11.13 — NavBar Badge Integration (Frontend)

**File:** `frontend/src/components/layout/navbar.tsx` (modified)

Add the notification bell with unread count to the authenticated NavBar state:

```tsx
// In the authenticated section of NavBar:
<div className="flex items-center gap-2">
  <NotificationBell
    unreadCount={unreadCount.data?.unread_count ?? 0}
    isOpen={bellOpen}
    onToggle={() => setBellOpen(!bellOpen)}
  />
  <AvatarDropdown user={user} />
  <WriteButton />
</div>
```

- Bell dropdown appears on click, closes on outside click or Escape
- Unread count polled every 30 seconds regardless of bell state
- When count changes audibly, no sound for MVP (future enhancement)

### F11.14 — Empty State (Frontend)

**File:** `frontend/src/components/notifications/empty-state.tsx`

- Hero illustration or icon (bell with a +)
- Heading: "No notifications yet"
- Description: "When someone likes your diary, comments on it, follows you, or bookmarks your entry, you'll see it here."
- "Explore diaries" CTA button linking to `/explore`

### F11.15 — Notification Preference Respect (Backend)

Ensure notification creation checks user preferences:

```python
prefs = recipient.get("preferences", {})
if notification_type == "like" and not prefs.get("notify_on_like", True):
    return None
if notification_type == "comment" and not prefs.get("notify_on_comment", True):
    return None
if notification_type == "follow" and not prefs.get("notify_on_follow", True):
    return None
if notification_type == "bookmark" and not prefs.get("notify_on_bookmark", True):
    return None
```

Preferences are set from M05 settings page. Default is `True` for all types.

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   └── notifications.py               # List, unread count, mark read, mark all read
├── models/
│   └── notification.py                 # NotificationCreate, NotificationResponse schemas
└── services/
    └── notification_service.py         # Notification creation, preference checks, message building
```

### Modified Files (Backend)
```
backend/app/api/v1/router.py           # Include notifications router
backend/app/db/indexes.py              # Add notifications collection indexes (compound, TTL)
backend/app/services/like_service.py   # Add notification hook after like
backend/app/services/comment_service.py # Add notification hook after comment
backend/app/services/follow_service.py  # Add notification hook after follow
backend/app/services/bookmark_service.py # Add notification hook after bookmark
```

### New Files (Frontend)
```
frontend/src/
├── app/(main)/
│   └── notifications/
│       └── page.tsx                   # Notification center page
├── components/
│   └── notifications/
│       ├── notification-item.tsx       # Single notification row
│       ├── notification-bell.tsx       # Bell icon with unread badge + dropdown
│       ├── notification-list.tsx       # Date-grouped notification list
│       └── empty-state.tsx             # "No notifications yet" state
├── hooks/
│   └── use-notifications.ts           # TanStack Query hooks with polling
```

### Modified Files (Frontend)
```
frontend/src/components/layout/navbar.tsx    # Add NotificationBell with unread count
frontend/src/components/providers/auth-provider.tsx # (optional) prefetch unread count on auth
```

---

## Database Changes

### New Collection: `notifications`

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,        // Recipient (indexed)
  actor_id: ObjectId,       // Who performed the action
  actor_username: string,   // Denormalized for fast display
  type: string,             // "like" | "comment" | "follow" | "bookmark"
  target_id: ObjectId|null, // Diary/comment/user ID
  target_type: string|null, // "diary" | "comment" | "user"
  message: string,          // Human-readable summary
  metadata: {},             // Extra data (diary_title, comment_excerpt, etc.)
  is_read: boolean,         // Default: false
  created_at: ISODate       // Used for TTL and sorting
}
```

### New Indexes

| Collection | Index | Purpose |
|-----------|-------|---------|
| `notifications` | `{ user_id: 1, is_read: 1, created_at: -1 }` | List notifications (unread first, newest first) |
| `notifications` | `{ user_id: 1, is_read: 1 }` | Fast unread count |
| `notifications` | `{ created_at: 1 }` (TTL, 90 days) | Auto-cleanup |

### Migrations
- Create `notifications` collection
- Create indexes on first run (handled by `init_db` or Alembic-like migration)
- Existing data: no migration needed (new collection)

---

## API Endpoints

| Method | Path | Auth | Rate Limit | Request | Response |
|--------|------|------|-----------|---------|----------|
| GET | `/notifications` | Bearer | — | `page, per_page` | `{ data: [...], meta: { total, unread_count, ... } }` |
| GET | `/notifications/unread-count` | Bearer | — | — | `{ data: { unread_count } }` |
| PUT | `/notifications/{id}/read` | Bearer | — | — | `{ data: { message } }` |
| PUT | `/notifications/read-all` | Bearer | — | — | `{ data: { message, count } }` |

### Notification Object
```json
{
  "id": "667a1b2c3d4e5f6a7b8c9d0e",
  "type": "like",
  "actor_username": "moonwriter",
  "actor_avatar_path": null,
  "message": "moonwriter liked your diary \"A Walk in the Rain\"",
  "target_id": "665a2b3c4d5e6f7a8b9c0d1e",
  "target_type": "diary",
  "is_read": false,
  "created_at": "2026-06-25T08:30:00Z",
  "time_ago": "2 hours ago"
}
```

---

## Frontend

### Pages
- `/notifications` — Notification center with date-grouped list, mark-all-read button, pagination

### Components
- `NotificationItem` — Single notification: type icon, actor avatar, message, timestamp, read indicator, click handler
- `NotificationBell` — NavBar bell icon with unread count badge and compact dropdown (last 5)
- `NotificationList` — Date-grouped list container with section headers (Today, Yesterday, This Week, Earlier)
- `EmptyState` — Hero illustration with description and explore CTA

### Hooks
- `useNotifications()` — TanStack Query with `refetchInterval: 30_000` for polling, includes `list`, `unreadCount`, `markRead`, `markAllRead`
- Optimistic updates for mark-as-read and mark-all-read

### State Management
- No dedicated Zustand store needed — TanStack Query cache and React component state handle it
- `useNotifications` hook manages all server state via query keys `["notifications"]`
- Local state for bell dropdown open/close (`useState` in NavBar)

### Routing
- `/notifications` — Protected route (redirects to login if unauthenticated)
- Clicking a notification navigates to target: `/diary/{id}` for likes/bookmarks, `/diary/{id}#comment-{id}` for comments, `/profile/{username}` for follows
- "View all" in bell dropdown navigates to `/notifications`

### Accessibility
- Notification bell: `aria-label="Notifications, {count} unread"`, `role="button"`, `aria-expanded` for dropdown
- Notification items: `role="button"`, `tabindex="0"`, `aria-label` with message text
- Read vs unread: not conveyed by color alone — uses bold text + left border + background tint (color+shape redundancy)
- Unread count: `aria-live="polite"` on badge for screen reader announcement
- Bell dropdown: `role="menu"` with `role="menuitem"` on items, keyboard navigation (arrow keys, Escape)
- Mark-all-read button: `aria-label="Mark all notifications as read"`

### Responsive Design
- Desktop (≥1024px): Full notification list with wider message area, avatars visible
- Tablet (768–1023px): Same layout, slightly smaller padding
- Mobile (<768px): Full-width list, compact items (avatar + message on same row, timestamp right-aligned), bell dropdown is full-width drawer
- Notification page: `max-w-2xl` centered on desktop, full-width on mobile

---

## Backend

### Services
- `notification_service.py` — Create notification with preference checks, self-action filter, message building

### Business Logic

**Notification creation flow:**
1. Called by like/comment/follow/bookmark service after successful action
2. Check self-action filter: if `recipient_id == actor_id`, return None
3. Check recipient's notification preferences for the given type
4. If disabled, return None (silently skip)
5. Look up actor's username (denormalize for performance)
6. Build human-readable message string
7. Insert notification document
8. Return notification ID (or None if skipped)

**List notifications flow:**
1. Query `notifications` collection by `user_id`
2. Sort: `is_read: 1` (unread first), then `created_at: -1` (newest)
3. Paginate with skip/limit
4. Count total and unread totals
5. Format with `time_ago` computed from `created_at`
6. Return paginated response

**Mark-as-read flow:**
1. Verify notification belongs to current user (or 404)
2. Update `is_read` to true
3. Return success

**Mark-all-read flow:**
1. Update all unread notifications for current user
2. Return count of updated documents

### Repositories
- `NotificationRepository`: `find_by_user`, `find_unread_count`, `mark_read`, `mark_all_read`, `create`, `delete_old` (TTL handles this automatically)

---

## Security

### Authentication
- All notification endpoints require valid Bearer token (only authenticated users have notifications)
- Unread count endpoint also requires auth (prevents leaking notification existence)

### Authorization
- Users can only access their own notifications (`user_id` filter set from JWT `sub`)
- Mark-as-read verifies ownership before updating
- IDOR prevention: `notification_id` in URL is checked against `user_id` before any mutation

### Privacy
- Notification messages contain only public information (username, diary title)
- Diary titles in notification messages are truncated to 50 chars
- No email addresses, no private content excerpts longer than 80 chars
- Self-action filter prevents notification loops and self-spam

### Rate Limiting
- No strict rate limiting on read/unread (these are lightweight operations)
- If abuse detected, can add 30/min rate limit on marked endpoints

### OWASP Considerations
- Mass assignment: Notification creation only accepts server-controlled fields (no user input in type, target fields)
- Injection: All query parameters validated with Pydantic
- CSRF: All mutating endpoints require Bearer token

---

## Performance

### Query Patterns
- **List:** Compound index `(user_id, is_read, created_at)` covers sort and filter — full index scan, no in-memory sort
- **Unread count:** Covered by compound index `(user_id, is_read)` — instant count
- **Mark read:** Update by `_id` + `user_id` — O(log n)
- **Mark all read:** Update by `user_id` + `is_read: false` — uses index

### Caching
- Unread count: Optional 10-second Redis cache `notifications:unread:{user_id}` — reduces DB load on 30-second polling cycle
- List results: Not cached (real-time requirement, frequent mutations)
- Cache invalidation: On mark-read or mark-all-read, delete unread count cache key

### Optimization Notes
- `actor_username` denormalized on notification document (no join/lookup needed)
- TTL index handles cleanup automatically — no cleanup jobs needed
- Notification creation is fire-and-forget; the action endpoint (like/comment) does not wait for notification insert
- Unread count endpoint is a fast index-covered query — suitable for 30-second polling at scale

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_create_like_notification` | Unit | Like action creates notification for diary owner |
| `test_create_comment_notification` | Unit | Comment action creates notification for diary owner |
| `test_create_follow_notification` | Unit | Follow action creates notification for followed user |
| `test_create_bookmark_notification` | Unit | Bookmark action creates notification for diary owner |
| `test_self_action_filter` | Unit | Own like/comment/follow/bookmark does not create notification |
| `test_notification_preference_respected` | Unit | Disabled notify_on_like prevents notification creation |
| `test_list_notifications` | Unit | Returns paginated list, unread first |
| `test_list_notifications_unread_count_meta` | Unit | Meta includes correct unread count |
| `test_unread_count_endpoint` | Unit | Returns fast count of unread notifications |
| `test_mark_read` | Unit | Single notification marked as read |
| `test_mark_read_other_user` | Unit | Cannot mark another user's notification as read (404) |
| `test_mark_all_read` | Unit | All unread notifications marked as read |
| `test_notification_ttl` | Unit | Notification older than 90 days removed (via TTL index) |
| `test_notification_list_unauthenticated` | Unit | Returns 401 without token |
| `test_notification_actor_deleted` | Unit | Notification with deleted actor still renders (graceful) |
| `test_bulk_notification_creation` | Unit | Multiple simultaneous notifications handled correctly |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Notification page renders | Unit | Loading → data → empty states |
| Notification item display | Unit | Icon, message, timestamp, read/unread styling correct |
| Notification item click | Unit | Click navigates to target and marks as read |
| Mark-all-read button | Unit | Button calls API and updates state |
| Notification bell badge | Unit | Shows correct unread count, hidden at 0 |
| Bell dropdown | Unit | Shows last 5 notifications, "View all" link |
| Empty state | Unit | "No notifications yet" with explore CTA |
| Polling behavior | Unit | refetchInterval set to 30 seconds |
| Optimistic mark-read | Unit | UI updates before API response; reverts on error |
| Date grouping | Unit | Notifications grouped by Today/Yesterday/Earlier |
| Unread styling | Unit | Unread items have distinct visual (bold, tinted background, left border) |
| Mobile responsive | Visual | Notification list and bell dropdown render correctly on mobile |

---

## Documentation

- `docs/api.md` — Update with notification endpoints, request/response schemas, error codes
- `docs/milestones/milestone-11.md` — This document

---

## Acceptance Criteria

1. Liking a diary creates a notification for the diary owner with the message "moonwriter liked your diary".
2. Commenting on a diary creates a notification for the diary owner with the message "moonwriter commented on your diary".
3. Following a user creates a notification for the followed user with the message "moonwriter started following you".
4. Bookmarking a diary creates a notification for the diary owner with the message "moonwriter bookmarked your diary".
5. Performing an action on your own content does NOT create a notification.
6. Disabling a notification type in settings prevents notifications of that type.
7. The `/notifications` page lists all notifications sorted unread-first, then newest.
8. The `/notifications/unread-count` endpoint returns just the count (fast).
9. Clicking a notification marks it as read and navigates to the target content.
10. The "Mark all as read" button marks all notifications as read.
11. The NavBar bell icon shows the current unread count as a badge.
12. The bell dropdown shows the 5 most recent notifications with "View all" link.
13. Notifications older than 90 days are automatically deleted.
14. A user cannot see another user's notifications.
15. The notification page shows a helpful empty state when no notifications exist.
16. The notification list polls every 30 seconds for new notifications.
17. All notification tests pass (`make test` from backend).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Notification spam (many likes on one diary) | Medium | Self-action filter already prevents. Future: rate-limit notification creation per user, or batch notifications ("moonwriter and 5 others liked your diary"). |
| Polling performance at scale | Low | Unread count uses covered index query (<1ms). List query paginates. If needed, increase poll interval to 60 seconds. |
| TTL index deletes notifications user might want | Low | 90-day retention is generous. Future milestone can add archive/export before making deletions permanent. |
| Race condition: mark all read while new notification arrives | Low | Mark all read sets `is_read: true` on all where `is_read: false` at time of update. New notification created after update has `is_read: false`. Acceptable eventual consistency. |
| Notification preference toggle race | Low | Preference is read at notification creation time. If user changes preference between action and notification creation, the preference at creation time wins. Acceptable. |

---

## Future Considerations

- Milestone 14 adds WebSocket-based real-time notifications, replacing 30-second polling.
- Milestone 15 adds email notifications (digest or instant) for users who opt in.
- Notification batching: "moonwriter and 3 others liked your diary" to reduce notification noise.
- Notification types extension: system announcements, milestone achievements, diary anniversary reminders.
- Sound/vibration on new notification (browser Notification API, opt-in).
- Push notifications via service worker for mobile web.
- Notification read receipts and delivery tracking.
