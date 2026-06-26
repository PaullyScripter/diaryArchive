# Milestone 12 — Admin Dashboard

## Overview

**Goal:** Administrators can moderate content, manage users, and monitor system health through a dedicated admin dashboard with reporting, audit logging, and statistics.

**Purpose:** As DiaryArchive grows, administrators need tools to maintain community health, enforce terms of service, respond to user reports, manage problematic users, and monitor system operations. Without admin tooling, moderation is impossible and abuse goes unchecked. This milestone provides the complete admin toolkit: a reporting system for users to flag content, an admin panel to review and act on reports, user management (ban/unban, role change), audit logging of all admin actions, and system health monitoring.

**Dependencies:** Milestone 06 (Public Diaries), Milestone 09 (Likes, Bookmarks, Comments), Milestone 04 (Authentication), Milestone 05 (User Profiles)

---

## Architecture Impact

### Backend
- New `reports` and `audit_logs` MongoDB collections
- Admin-only middleware dependency (`require_admin`) that checks `is_admin` flag on user
- Reporting endpoints: submit report, list reports (admin), update report status (admin)
- User management endpoints: list/search users (admin), ban/unban, change role
- Audit logging service that automatically logs all admin actions
- Dashboard stats endpoint (aggregated counts: users, diaries, reports, storage)
- Health check endpoint (service status: MongoDB, Redis, Meilisearch, storage)
- Stats are cached in Redis with 5-minute TTL

### Frontend
- Admin layout with sidebar navigation (already built in M03, now populated)
- Admin overview page with stats cards (users, diaries, reports, storage)
- Report queue page with table and status management
- Report review workflow (view reported content, take action: dismiss/warn/remove)
- User management page (search, view details, ban/unban, change role)
- Audit log viewer (filterable log table with pagination)
- System health page (service status indicators with last-check timestamps)
- Conditional admin nav visibility (only shown to admin users)

### Database
- New collection: `reports` — stores user-submitted reports with status, resolution
- New collection: `audit_logs` — append-only log of all admin actions
- No changes to existing collections (new fields added: none)

### API
- 9 new endpoints: submit report, list/update reports (admin), list/search users (admin), ban/unban user, change role, audit logs, stats, health
- All admin endpoints use `require_admin` dependency
- Standard `{ data: { ... } }` envelope

### Security
- `is_admin` flag enforced at middleware level on all admin endpoints
- Audit logging of every admin action (who did what, when, to whom)
- Report submission rate-limited (5/min per user)
- Admin status changes are themselves audited and logged
- Ban/unban includes reason field (auditable)
- Admin endpoints return 403 for non-admin users (no information leakage)

---

## Features

### F12.1 — Admin Middleware (Backend)

**File:** `backend/app/api/deps.py` (modified)

```python
async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify the current user has admin privileges."""
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

Applied as a dependency to all admin router endpoints:

```python
router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])
```

### F12.2 — Report System (Backend)

**File:** `backend/app/api/v1/endpoints/reports.py`

**F12.2.1 — POST /api/v1/reports**

Submit a report against a diary, comment, or user.

- Auth: Bearer access token required
- Rate limit: 5/min per user
- Request:
```json
{
  "target_type": "diary",
  "target_id": "665a2b3c4d5e6f7a8b9c0d1e",
  "reason": "inappropriate_content",
  "description": "This diary contains hate speech targeting a specific group."
}
```
- `reason` must be one of: `spam`, `inappropriate_content`, `harassment`, `impersonation`, `copyright_violation`, `other`
- `description` optional, max 1000 chars
- Prevents duplicate reports (same user + same target_id + pending status = 409)
- Response 201: `{ "data": { "id": "...", "message": "Report submitted" } }`

**F12.2.2 — GET /api/v1/admin/reports**

List reports with status filtering. Admin only.

- Auth: Bearer + admin required
- Query: `status` (pending/resolved/dismissed, default: pending), `page`, `per_page`, `sort` (created_at, -created_at)
- Response:
```json
{
  "data": [
    {
      "id": "668a1b2c...",
      "reporter": { "id": "...", "username": "reporter_user" },
      "target_type": "diary",
      "target_id": "665a2b3c...",
      "target_preview": { "title": "Offensive Title", "author_username": "author_user", "excerpt": "..." },
      "reason": "inappropriate_content",
      "description": "This diary contains...",
      "status": "pending",
      "resolution_note": null,
      "resolved_by": null,
      "resolved_at": null,
      "created_at": "2026-06-25T08:30:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 5, "has_next": false, "has_prev": false }
}
```

- Target preview: Include enough context for admin review (diary title + first 200 chars for diary, comment body for comment, username + bio for user)
- Enriches reports with reporter info and target preview in a single batch query

**F12.2.3 — PUT /api/v1/admin/reports/{id}**

Update report status. Admin only.

- Request:
```json
{
  "status": "resolved",
  "resolution_note": "Diary removed. User warned. Content violated TOS section 3.2."
}
```
- Status options: `resolved` (action taken), `dismissed` (no action needed)
- Cannot change from resolved/dismissed back to pending
- Requires `resolution_note` (min 10 chars for resolved, optional for dismissed)
- Sets `resolved_by` to current admin user, `resolved_at` to current timestamp
- Logs action to audit log automatically
- Response 200: `{ "data": { "id": "...", "status": "resolved", "message": "Report resolved" } }`

### F12.3 — User Management (Backend)

**File:** `backend/app/api/v1/endpoints/admin_users.py`

**F12.3.1 — GET /api/v1/admin/users**

List and search users. Admin only.

- Auth: Bearer + admin required
- Query: `q` (search username, case-insensitive), `page`, `per_page`, `sort` (created_at, -created_at, username), `status` (active, banned, all)
- Response:
```json
{
  "data": [
    {
      "id": "665a1b2c...",
      "username": "moonwriter",
      "has_email": true,
      "email_verified": true,
      "is_admin": false,
      "is_banned": false,
      "ban_reason": null,
      "stats": { "diary_count": 24, "follower_count": 8, "following_count": 12 },
      "created_at": "2025-12-01T14:30:00Z",
      "last_login_at": "2026-06-24T10:15:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 1423, ... }
}
```

- Does NOT expose password_hash, email_encrypted, email_hash, or other sensitive fields
- Search is case-insensitive regex on username (indexed for performance)

**F12.3.2 — PUT /api/v1/admin/users/{id}/ban**

Ban or unban a user. Admin only.

- Request:
```json
{
  "is_banned": true,
  "reason": "Repeated violations of TOS section 3.2 — hate speech after 3 warnings"
}
```
- Setting `is_banned: true` bans the user, `false` unbans
- `reason` required when banning (min 10 chars), optional when unbanning
- Cannot ban another admin (returns 400)
- Side effects of ban:
  - `is_banned` flag set on user document
  - All user's refresh tokens invalidated (bulk delete)
  - User's diaries become invisible in public feeds (filtered in diary queries)
  - User's comments hidden (replaced with "[comment removed]")
  - Logs action to audit log
- Response 200: `{ "data": { "id": "...", "is_banned": true, "message": "User banned" } }`

**F12.3.3 — PUT /api/v1/admin/users/{id}/role**

Change a user's admin status. Admin only.

- Request: `{ "is_admin": true }`
- Cannot change own admin status (self-protection — must be done by another admin)
- Cannot demote the last admin (prevent lockout)
- Logs action to audit log
- Response 200: `{ "data": { "id": "...", "is_admin": true, "message": "User role updated" } }`

### F12.4 — Audit Logging (Backend)

**File:** `backend/app/services/audit_service.py`

Automatic logging of all admin actions.

```python
class AuditService:
    def __init__(self, db):
        self.collection = db.audit_logs

    async def log(
        self,
        admin_id: str,
        admin_username: str,
        action: str,
        target_type: str,
        target_id: str | None = None,
        details: dict | None = None,
    ) -> str:
        """Record an admin action in the audit log."""
        entry = {
            "admin_id": ObjectId(admin_id),
            "admin_username": admin_username,
            "action": action,           # e.g. "ban_user", "resolve_report", "change_role"
            "target_type": target_type,  # e.g. "user", "report", "diary"
            "target_id": ObjectId(target_id) if target_id else None,
            "details": details or {},    # e.g. {"reason": "...", "previous_role": false}
            "ip_address": None,          # Populated from request context if available
            "created_at": datetime.utcnow(),
        }
        result = await self.collection.insert_one(entry)
        return str(result.inserted_id)
```

**Audit log actions:**

| Action | Target Type | Details |
|--------|------------|---------|
| `resolve_report` | report | `{ status, resolution_note }` |
| `dismiss_report` | report | `{ resolution_note }` |
| `ban_user` | user | `{ reason }` |
| `unban_user` | user | `{ reason }` |
| `change_role` | user | `{ previous_is_admin, new_is_admin }` |
| `delete_diary` | diary | `{ diary_title, author_username }` |
| `delete_comment` | comment | `{ diary_id, comment_excerpt }` |

**F12.4.1 — GET /api/v1/admin/audit-logs**

View audit logs. Admin only.

- Auth: Bearer + admin required
- Query: `action` (filter by action type), `target_type`, `admin_id`, `page`, `per_page`, `from_date`, `to_date`
- Sorted by `created_at: -1` (newest first)
- Response: paginated list of audit log entries

### F12.5 — Dashboard Stats Endpoint (Backend)

**File:** `backend/app/api/v1/endpoints/admin_stats.py`

**F12.5.1 — GET /api/v1/admin/stats**

Dashboard statistics. Admin only.

```python
async def get_admin_stats():
    """Aggregate platform-wide statistics, cached in Redis."""
    cache_key = "admin:stats"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    stats = {
        "users": {
            "total": await db.users.count_documents({}),
            "active_30d": await db.users.count_documents({"last_login_at": {"$gte": now - timedelta(days=30)}}),
            "banned": await db.users.count_documents({"is_banned": True}),
            "admins": await db.users.count_documents({"is_admin": True}),
            "with_email": await db.users.count_documents({"email_hash": {"$ne": None}}),
        },
        "diaries": {
            "total": await db.diaries.count_documents({}),
            "public": await db.diaries.count_documents({"privacy": "public"}),
            "private": await db.diaries.count_documents({"privacy": "private"}),
            "draft": await db.diaries.count_documents({"privacy": "draft"}),
            "total_with_tags": await db.diaries.count_documents({"tags": {"$ne": []}}),
            "avg_tags_per_diary": ...,  # aggregation pipeline
        },
        "interactions": {
            "total_likes": await db.likes.count_documents({}),
            "total_comments": await db.comments.count_documents({}),
            "total_bookmarks": await db.bookmarks.count_documents({}),
            "total_follows": await db.follows.count_documents({}),
        },
        "reports": {
            "pending": await db.reports.count_documents({"status": "pending"}),
            "resolved_today": await db.reports.count_documents({
                "status": "resolved",
                "resolved_at": {"$gte": now.replace(hour=0, minute=0, second=0)},
            }),
            "total": await db.reports.count_documents({}),
        },
        "storage": {
            "total_diaries_size_bytes": ...,  # aggregation on content_html + content_text sizes
            "meilisearch_doc_count": ...,     # from Meilisearch index stats
        },
        "system": {
            "uptime_days": ...,               # from server start time
            "last_full_reindex": ...,          # from Meilisearch sync timestamp
        },
    }

    await redis.setex(cache_key, 300, json.dumps(stats))  # 5-minute cache
    return {"data": stats}
```

- Response: `{ "data": { users: {...}, diaries: {...}, interactions: {...}, reports: {...}, storage: {...}, system: {...} } }`
- Cached in Redis for 5 minutes (TTL)

### F12.6 — Health Check Endpoint (Backend)

**File:** `backend/app/api/v1/endpoints/admin_health.py`

**F12.6.1 — GET /api/v1/admin/health**

Service health status. Admin only.

```python
async def get_health():
    """Check health of all backing services."""
    checks = {}

    # MongoDB
    try:
        await db.command("ping")
        checks["mongodb"] = {"status": "healthy", "latency_ms": ...}
    except Exception as e:
        checks["mongodb"] = {"status": "unhealthy", "error": str(e)}

    # Redis
    try:
        await redis.ping()
        checks["redis"] = {"status": "healthy", "latency_ms": ...}
    except Exception as e:
        checks["redis"] = {"status": "unhealthy", "error": str(e)}

    # Meilisearch
    try:
        health = client.health()
        checks["meilisearch"] = {
            "status": "healthy" if health.get("status") == "available" else "degraded",
            "latency_ms": ...,
        }
    except Exception as e:
        checks["meilisearch"] = {"status": "unhealthy", "error": str(e)}

    # Overall status
    all_healthy = all(c["status"] == "healthy" for c in checks.values())
    overall_status = "healthy" if all_healthy else "degraded"

    return {
        "data": {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": checks,
        }
    }
```

### F12.7 — Admin Layout (Frontend)

**File:** `frontend/src/components/layout/admin-layout.tsx` (populated from M03 placeholder)

**Sidebar navigation:**

```
┌──────────────┬──────────────────────────┐
│ ⚙️ Dashboard │  ← active state          │
│ 📋 Reports   │                          │
│ 👥 Users     │                          │
│ 📜 Audit Log │                          │
│ ❤️ Health    │                          │
│              │                          │
│ ← Back to    │  (content area)          │
│   Site       │                          │
└──────────────┴──────────────────────────┘
```

- Sidebar: `w-56` fixed on desktop, hidden on mobile (hamburger toggle)
- Active state: highlighted nav item with accent left border
- Top bar: "Admin Dashboard" title + admin badge (small shield icon + "Admin")
- "Back to Site" link at bottom of sidebar
- Content area: fills remaining width, scrollable

### F12.8 — Admin Overview Page (Frontend)

**File:** `frontend/src/app/admin/page.tsx`

Stats dashboard with card grid:

```
┌──────────────────────────────────────────────────┐
│ Admin Dashboard                                   │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│ │ 1,423 │ │ 8,947 │ │   5  │ │ 256MB │            │
│ │ Users │ │Diaries│ │Reports│ │Storage│            │
│ │ +12%  │ │ +8%   │ │pending│ │      │            │
│ └──────┘ └──────┘ └──────┘ └──────┘             │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│ │  142  │ │ 2,301 │ │  892  │ │3 admins│          │
│ │Active │ │ Likes │ │Comments│ │      │            │
│ │30d    │ │       │ │       │ │      │            │
│ └──────┘ └──────┘ └──────┘ └──────┘             │
└──────────────────────────────────────────────────┘
```

- Each stat card: icon + label + value + optional trend indicator
- Cards are `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Loading: skeleton cards
- Error: "Couldn't load stats" with retry
- Data fetched from `GET /api/v1/admin/stats`

### F12.9 — Report Queue Page (Frontend)

**File:** `frontend/src/app/admin/reports/page.tsx`

```
┌─────────────────────────────────────────────────┐
│ Reports                    [Pending ▼] [Search]  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Status │ Target     │ Reason       │ Reporter│ │
│ │ Pending│ Diary: ... │ inappropriate│ user_x  │ │
│ │        │ "Offensive │ _content     │         │ │
│ │        │ Title"     │              │         │ │
│ │ Pending│ User: user_│ harassment   │ user_y  │ │
│ │        │ y          │              │         │ │
│ │ ...    │            │              │         │ │
│ └──────────────────────────────────────────────┘ │
│ [Load More]                                       │
└─────────────────────────────────────────────────┘
```

- Table with columns: Status (with colored badge), Target Type + Preview, Reason, Reporter, Date, Actions
- Status filter tabs: Pending / Resolved / Dismissed / All
- Search by reporter username or target ID
- Click row to expand report detail or navigate to review page
- Actions per row: Review (opens detail), Resolve (quick action with confirmation), Dismiss (quick action with confirmation)

### F12.10 — Report Review Workflow (Frontend)

**File:** `frontend/src/app/admin/reports/[id]/page.tsx`

```
┌──────────────────────────────────────────────────┐
│ ← Back to Reports                                │
│ ──────────────────────────────────────────────── │
│ Report #668a1b2c                                 │
│                                                   │
│ Reported by: reporter_user  ·  2 hours ago       │
│ Target: Diary "Offensive Title" by author_user   │
│ Reason: inappropriate_content                    │
│ Description: This diary contains hate speech...  │
│                                                   │
│ ┌──────────────────────────────────┐             │
│ │ Target Preview                    │             │
│ │ [rendered diary content in an     │             │
│ │  iframe or safe preview box]      │             │
│ │ [View full diary ↗]               │             │
│ └──────────────────────────────────┘             │
│                                                   │
│ ┌──────────────────────────────────┐             │
│ │ Action                           │             │
│ │ [Resolve — warn user]            │             │
│ │ [Resolve — remove content]       │             │
│ │ [Dismiss — no violation]         │             │
│ │                                   │             │
│ │ Resolution note: [textarea]       │             │
│ │ [Submit]                          │             │
│ └──────────────────────────────────┘             │
└──────────────────────────────────────────────────┘
```

- Shows full target content in a preview section (read-only rendered view of the diary/comment/profile)
- Action buttons for common moderator actions:
  - "Resolve — warn user": Sets report resolved, creates audit log
  - "Resolve — remove content": Deletes the reported content, sets report resolved, creates audit log
  - "Dismiss — no violation": Sets report dismissed
- Resolution note textarea (required for resolve, optional for dismiss)
- Confirmation dialog before destructive actions (remove content)

### F12.11 — User Management Page (Frontend)

**File:** `frontend/src/app/admin/users/page.tsx`

```
┌────────────────────────────────────────────────────┐
│ Users                    [🔍 Search by username]    │
│ ┌──────┬────────┬──────┬──────┬──────┬───────────┐ │
│ │ Avatar│Username│Status│Admin │Diaries│Actions   │ │
│ │  img  │moonwri │Active│ Yes  │  24  │[Manage]  │ │
│ │       │ter     │      │      │      │           │ │
│ │  img  │user_abc│Banned│ No   │   5  │[Manage]  │ │
│ └──────┴────────┴──────┴──────┴──────┴───────────┘ │
│ [Load More]                                         │
└─────────────────────────────────────────────────────┘
```

- Table with search input (searches by username, debounced 300ms)
- Columns: Avatar (small), Username (clickable → user detail), Status (Active/Banned badge), Admin (Yes/No badge), Diaries count, Actions
- Status badges: green for Active, red for Banned
- Click username to view user detail modal or expandable row
- Actions button: dropdown with Ban/Unban, Change Role, View Profile

**User detail view** (inline expand or modal):
```
Username: moonwriter
Email: has_email ✓, verified ✓
Admin: Yes
Banned: No
Created: Dec 1, 2025
Last login: Jun 24, 2026
Stats: 24 diaries, 8 followers, 12 following
Ban history: (none)
Actions: [Ban User] [Remove Admin] [View Profile]
```

**Ban confirmation dialog:**
```
┌──────────────────────────────────────┐
│  ⚠️ Ban user "moonwriter"?           │
│                                      │
│  This will:                          │
│  • Prevent login                     │
│  • Hide all diaries from public      │
│  • Hide all comments                 │
│  • Revoke all sessions               │
│                                      │
│  Reason for ban:                     │
│  [textarea, min 10 chars]            │
│                                      │
│  [Cancel]  [Confirm Ban]             │
└──────────────────────────────────────┘
```

### F12.12 — Audit Log Viewer (Frontend)

**File:** `frontend/src/app/admin/audit-logs/page.tsx`

```
┌────────────────────────────────────────────────┐
│ Audit Logs          [Filter: All ▼] [Date ▼]   │
│ ┌──────┬──────┬──────┬──────┬────────────────┐ │
│ │ Time │Admin │Action│Target│Details         │ │
│ │ 10:15│ admin│ban   │user  │Reason: TOS v3.2│ │
│ │      │_user │_user │_abc  │                │ │
│ │ 09:30│ admin│resolv│report│Note: Content   │ │
│ │      │_user │e_repo│#123  │removed         │ │
│ │ ...  │      │rt    │      │                │ │
│ └──────┴──────┴──────┴──────┴────────────────┘ │
│ [Load More]                                      │
└────────────────────────────────────────────────┘
```

- Filter dropdown by action type: All, Ban, Report Resolution, Role Change, Deletion
- Date range picker (from/to)
- Table with columns: Timestamp, Admin username, Action (with icon), Target (ID + type), Details (truncated with expand)
- Click row to expand details showing full JSON of the action's detail object
- Empty state: "No audit logs match your filters"

### F12.13 — System Health Page (Frontend)

**File:** `frontend/src/app/admin/health/page.tsx`

```
┌────────────────────────────────────────────────┐
│ System Health           Last checked: 2m ago   │
│                                                │
│ ┌ Services ─────────────────────────────────┐  │
│ │ ✅ MongoDB          ·  2ms latency       │  │
│ │ ✅ Redis            ·  1ms latency       │  │
│ │ ✅ Meilisearch      ·  5ms latency       │  │
│ │ ⚠️ Storage (MinIO)  ·  Not configured    │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ ┌ Indexing ───────────────────────────────┐   │
│ │ Meilisearch docs: 8,947                 │   │
│ │ Last full re-index: Jun 25, 2026 03:00  │   │
│ │ MongoDB public diaries: 8,947           │   │
│ │ ✅ In sync                              │   │
│ └──────────────────────────────────────────┘  │
│                                                │
│ [Refresh]                                       │
└────────────────────────────────────────────────┘
```

- Each service: status icon + name + latency + last check timestamp
- Automatic refresh every 30 seconds (polling)
- Manual "Refresh" button
- Storage section shows MinIO connection status (placeholder until M13)
- Indexing section shows Meilisync health

### F12.14 — Conditional Admin Nav (Frontend)

**File:** `frontend/src/components/layout/navbar.tsx` (modified)

- Admin link only visible when `user.is_admin === true`
- Shows in NavBar avatar dropdown as "Admin Dashboard" with shield icon
- Admin link routes to `/admin`
- Non-admin users never see the admin entry point

**File:** `frontend/src/middleware.ts` (new or modified)

Next.js middleware to protect admin routes:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) {
    // Check for admin cookie or token claim
    // Redirect to /login if not admin
    // (Alternatively, check on client side after auth store hydration)
  }
}
```

Since admin status is in the JWT, client-side protection in layout.tsx is the primary guard. Server-side middleware adds a secondary check against the `/admin` route group.

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   ├── reports.py                       # POST /reports (user submit)
│   ├── admin_reports.py                 # GET/PUT /admin/reports
│   ├── admin_users.py                   # GET /admin/users, PUT ban, PUT role
│   ├── admin_stats.py                   # GET /admin/stats
│   ├── admin_audit_logs.py              # GET /admin/audit-logs
│   └── admin_health.py                  # GET /admin/health
├── models/
│   ├── report.py                        # ReportCreate, ReportResponse, ReportUpdate
│   └── audit_log.py                     # AuditLogEntry model
└── services/
    └── audit_service.py                 # Automatic admin action logging
```

### Modified Files (Backend)
```
backend/app/api/v1/router.py             # Include all new routers
backend/app/api/deps.py                  # Add require_admin dependency
backend/app/db/indexes.py                # Add reports and audit_logs indexes
backend/app/main.py                      # Initialize admin data on startup (optional)
```

### New Files (Frontend)
```
frontend/src/
├── app/admin/
│   ├── reports/
│   │   ├── page.tsx                     # Report queue table
│   │   └── [id]/page.tsx                # Report review workflow
│   ├── users/
│   │   └── page.tsx                     # User management
│   ├── audit-logs/
│   │   └── page.tsx                     # Audit log viewer
│   └── health/
│       └── page.tsx                     # System health
├── components/
│   └── admin/
│       ├── stats-card.tsx               # Stat card with icon, value, label
│       ├── report-table.tsx             # Report queue table
│       ├── report-review.tsx            # Report review workflow
│       ├── user-table.tsx               # User management table
│       ├── user-detail-modal.tsx        # User detail modal
│       ├── ban-dialog.tsx              # Ban confirmation dialog
│       ├── audit-log-table.tsx          # Audit log table with filters
│       ├── health-indicator.tsx         # Service health indicator dot + label
│       └── admin-sidebar.tsx            # Admin sidebar navigation
├── hooks/
│   ├── use-admin-stats.ts              # TanStack Query for admin stats
│   ├── use-admin-reports.ts            # TanStack Query for reports
│   ├── use-admin-users.ts              # TanStack Query for user list
│   ├── use-admin-audit-logs.ts         # TanStack Query for audit logs
│   └── use-admin-health.ts             # TanStack Query for health check
```

### Modified Files (Frontend)
```
frontend/src/app/(main)/layout.tsx       # Already includes admin route (from M03)
frontend/src/app/admin/page.tsx          # Replace placeholder with overview stats
frontend/src/app/admin/layout.tsx        # Wire admin sidebar with real navigation
frontend/src/components/layout/navbar.tsx # Add conditional "Admin Dashboard" link
frontend/src/components/layout/admin-layout.tsx # Populate sidebar links, data
frontend/src/middleware.ts               # (optional) Add admin route protection
```

---

## Database Changes

### New Collection: `reports`

```javascript
{
  _id: ObjectId,
  reporter_id: ObjectId,        // User who submitted the report
  target_type: string,          // "diary" | "comment" | "user"
  target_id: ObjectId,          // ID of the reported content/user
  reason: string,               // Enum: spam, inappropriate_content, harassment, impersonation, copyright_violation, other
  description: string,          // Optional user-provided description (max 1000 chars)
  status: string,               // "pending" | "resolved" | "dismissed"
  resolution_note: string|null, // Admin note on resolution
  resolved_by: ObjectId|null,   // Admin who resolved
  resolved_at: ISODate|null,    // When resolved
  created_at: ISODate
}
```

### New Collection: `audit_logs`

```javascript
{
  _id: ObjectId,
  admin_id: ObjectId,           // Admin who performed the action
  admin_username: string,       // Denormalized for fast display
  action: string,               // e.g. "ban_user", "resolve_report", "change_role"
  target_type: string,          // "user" | "report" | "diary" | "comment"
  target_id: ObjectId|null,
  details: {},                  // Arbitrary JSON with action-specific data
  ip_address: string|null,      // Admin's IP at time of action
  created_at: ISODate
}
```

### New Indexes

| Collection | Index | Purpose |
|-----------|-------|---------|
| `reports` | `{ status: 1, created_at: -1 }` | Filter by status, sorted by new |
| `reports` | `{ reporter_id: 1, target_id: 1, status: 1 }` | Prevent duplicate pending reports |
| `reports` | `{ created_at: 1 }` (TTI, 1 year) | Auto-cleanup old resolved/dismissed reports |
| `audit_logs` | `{ created_at: -1 }` | Default sort (newest first) |
| `audit_logs` | `{ action: 1, created_at: -1 }` | Filter by action type |
| `audit_logs` | `{ admin_id: 1, created_at: -1 }` | Filter by admin |
| `audit_logs` | `{ created_at: 1 }` (TTI, 1 year) | Auto-cleanup old logs |

### Migrations
- Create `reports` and `audit_logs` collections with indexes
- Seed initial admin user (set `is_admin: true` on the first registered user, or via seed script)
- Add `is_admin` flag to existing users if not present (default: false)

---

## API Endpoints

### User-Facing Endpoints

| Method | Path | Auth | Rate Limit | Request | Response |
|--------|------|------|-----------|---------|----------|
| POST | `/reports` | Bearer | 5/min/user | `{ target_type, target_id, reason, description? }` | `{ data: { id, message } }` |

### Admin-Only Endpoints (all require Bearer + admin)

| Method | Path | Rate Limit | Request | Response |
|--------|------|-----------|---------|----------|
| GET | `/admin/reports` | — | `status, page, per_page, sort` | `{ data: [...], meta }` |
| PUT | `/admin/reports/{id}` | — | `{ status, resolution_note }` | `{ data: { id, status, message } }` |
| GET | `/admin/users` | — | `q, page, per_page, sort, status` | `{ data: [...], meta }` |
| PUT | `/admin/users/{id}/ban` | — | `{ is_banned, reason }` | `{ data: { id, is_banned, message } }` |
| PUT | `/admin/users/{id}/role` | — | `{ is_admin }` | `{ data: { id, is_admin, message } }` |
| GET | `/admin/audit-logs` | — | `action, target_type, admin_id, from_date, to_date, page, per_page` | `{ data: [...], meta }` |
| GET | `/admin/stats` | — | — | `{ data: { users, diaries, interactions, reports, storage, system } }` |
| GET | `/admin/health` | — | — | `{ data: { status, timestamp, checks } }` |

---

## Frontend

### Pages
- `/admin` — Overview dashboard with stats cards
- `/admin/reports` — Report queue table with status filter
- `/admin/reports/{id}` — Report review workflow with target preview and action buttons
- `/admin/users` — User management with search, ban/unban, role change
- `/admin/audit-logs` — Audit log viewer with action/date filters
- `/admin/health` — System health dashboard with service status indicators

### Components
- `StatsCard` — Stat display: icon, value, label, optional trend
- `ReportTable` — Report queue table with status badges, row expansion
- `ReportReview` — Report detail with target preview and action workflow
- `UserTable` — User management table with search, action dropdown
- `UserDetailModal` — Full user detail view in modal
- `BanDialog` — Confirmation dialog with reason textarea
- `AuditLogTable` — Filterable log table with expandable detail rows
- `HealthIndicator` — Service health dot (green/yellow/red) + label + latency
- `AdminSidebar` — Navigation sidebar with active state

### Hooks
- `useAdminStats()` — TanStack Query for `GET /admin/stats`, staleTime 5min
- `useAdminReports(filters)` — TanStack Query for `GET /admin/reports`
- `useUpdateReport()` — TanStack Query mutation for `PUT /admin/reports/{id}`
- `useAdminUsers(filters)` — TanStack Query for `GET /admin/users`
- `useBanUser()` — TanStack Query mutation for `PUT /admin/users/{id}/ban`
- `useChangeUserRole()` — TanStack Query mutation for `PUT /admin/users/{id}/role`
- `useAdminAuditLogs(filters)` — TanStack Query for `GET /admin/audit-logs`
- `useAdminHealth()` — TanStack Query for `GET /admin/health`, refetchInterval 30s

### State Management
- TanStack Query cache for all admin data (no Zustand needed)
- URL query params for filters (status, search, page) — shareable report queue URLs
- React state for modals (ban dialog, user detail, confirmation)

### Routing
- `/admin/*` — All admin routes protected by the admin layout's check
- Admin layout checks `user.is_admin` on mount; if not admin, redirects to `/` with a toast "Admin access required"
- URL params for report detail: `/admin/reports/{id}`
- Query params for filters: `/admin/reports?status=pending&page=1`

### Accessibility
- Admin sidebar: `role="navigation"`, `aria-label="Admin navigation"`
- Stat cards: `role="region"`, `aria-label="Total users"` etc.
- Tables: proper `<table>`, `<th>` with `scope`, `<caption>` or `aria-label`
- Sortable columns: buttons with `aria-sort` attribute
- Action buttons: `aria-label="Ban user moonwriter"`
- Confirmation dialogs: `role="alertdialog"`, `aria-describedby` linking to description
- Status badges: color not sole conveyer (e.g., "Banned" text + red color)
- Search input: `aria-label="Search users by username"`
- Focus management: focus first input on dialog open, restore focus on close

### Responsive Design
- Desktop (≥1024px): Full sidebar + content layout, multi-column stat grids
- Tablet (768–1023px): Collapsed sidebar (icons only) or hamburger toggle
- Mobile (<768px): Hidden sidebar (hamburger menu), single-column stats, horizontal-scroll tables with sticky first column, stacked card layout instead of tables for user/report lists
- Admin pages: `max-w-6xl` on desktop, full-width on mobile

---

## Backend

### Services
- `audit_service.py` — Log all admin actions to `audit_logs` collection with structured data

### Business Logic

**Report submission flow:**
1. Validate target_type, target_id, reason (Pydantic)
2. Check target exists in the relevant collection (diary/comment/user)
3. Check for existing pending report from same user on same target → 409 if exists
4. Create report document with `status: "pending"`
5. Return report ID

**Report resolution flow:**
1. Fetch report, verify it exists and is still pending
2. Set status to `resolved` or `dismissed`
3. Set `resolved_by` to current admin, `resolved_at` to now
4. Set `resolution_note`
5. If action includes content removal, delete the target content
6. Log audit entry

**Ban user flow:**
1. Fetch user, verify not already in requested state
2. Prevent banning another admin (400 error)
3. Set `is_banned` on user document
4. Delete all refresh tokens for that user
5. Log audit entry

**Role change flow:**
1. Fetch user, verify target exists
2. Prevent self-demotion (400 error)
3. Check at least one admin remains (prevent last admin demotion)
4. Update `is_admin` flag
5. Log audit entry

### Repositories
- `ReportRepository`: `create`, `find_by_id`, `find_by_status`, `find_duplicate`, `update_status`, `count_by_status`
- `AuditLogRepository`: `create`, `find_by_filters` (action, target_type, admin_id, date range, paginated), `count_by_action`
- User management uses existing `UserRepository` with `find_by_username_search`, `update_ban_status`, `update_role`

### Background Workers
- `cleanup_old_reports` — Optional: delete resolved/dismissed reports older than 1 year (TTL index handles this)
- `cleanup_old_audit_logs` — Optional: TTL index applies here too

---

## Security

### Authentication
- All admin endpoints require valid Bearer token AND `is_admin: true` flag
- `require_admin` dependency is applied to the entire admin router prefix
- Reports can be submitted by any authenticated user (not admin-only)

### Authorization
- `is_admin` flag checked on every admin request — no exceptions
- Cannot ban another admin (self-protection)
- Cannot change own admin role (must be done by another admin)
- Cannot demote the last remaining admin (prevents platform lockout)
- Report resolution: admin can only resolve/dismiss, not delete report documents

### Privacy
- Admin user list does NOT expose email, password_hash, or encryption keys
- Audit logs record admin actions but not user PII
- Report descriptions are visible to admins only (not public)
- Banned user's diaries are hidden from public (filtered at query level)
- Banned user's comments replaced with "[comment removed]" placeholder

### Rate Limiting
- POST `/reports`: 5/min per user (prevents report abuse)
- Admin endpoints: no specific rate limit (trusted users), but standard global rate limiting applies

### Audit Trail
- Every admin action is logged with: admin identity, action type, target, timestamp, and details
- Audit logs are append-only (no deletion or modification)
- Audit logs retained for 1 year (TTL index)
- Ban/reason required — ensures accountability

### OWASP Considerations
- Mass assignment: Only documented fields accepted in all admin mutations (Pydantic models)
- Injection: All inputs validated, MongoDB queries use parameters, not string concatenation
- CSRF: All mutating endpoints require Bearer token
- IDOR: Report/user ID ranges cannot be enumerated by non-admins (403 on admin prefix)
- Security logging: All admin actions logged with timestamp and admin identity

---

## Performance

### Query Patterns
- **Admin stats:** Multiple `count_documents` calls and 1-2 aggregation pipelines. Cached in Redis for 5 minutes — dashboard is read-heavy, not real-time.
- **Report list:** Filtered by status index `(status, created_at)` — O(log n). No enrichment joins needed (reporter info denormalized in response).
- **User search:** Case-insensitive regex on username. At scale, consider a dedicated search index or Meilisearch for user search.
- **Audit logs:** Filtered scan with index on `(action, created_at)` — O(log n). Append-only means no write contention.
- **Health check:** Ping each service sequentially (<10ms per service). Called every 30 seconds by the frontend. Lightweight.

### Caching Strategy
| Data | Cache | TTL | Invalidation |
|------|-------|-----|-------------|
| Dashboard stats | Redis | 5 min | TTL-based expiry |
| Report counts | Redis | 1 min | On new report or status change |
| Health check results | Redis | 30 sec | TTL-based expiry |

### Optimization Notes
- Admin users are typically few (<10), so admin endpoint load is negligible
- Report creation and audit logging are fire-and-forget writes (no read after write)
- Audit logs are append-only, never updated — ideal for TTL-based auto-cleanup
- User search uses regex on `username` with a sparse index; for larger deployments, add Meilisearch user index

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_submit_report` | Unit | Valid report submission returns 201 |
| `test_submit_report_duplicate` | Unit | Duplicate pending report returns 409 |
| `test_submit_report_invalid_target` | Unit | Non-existent target returns 404 |
| `test_submit_report_rate_limit` | Integration | Exceeding 5/min returns 429 |
| `test_admin_list_reports` | Unit | Returns paginated reports filtered by status |
| `test_admin_list_reports_non_admin` | Unit | Non-admin receives 403 |
| `test_admin_resolve_report` | Unit | Report status updated to resolved |
| `test_admin_dismiss_report` | Unit | Report status updated to dismissed |
| `test_admin_resolve_report_removes_content` | Integration | Resolve with remove deletes target diary |
| `test_admin_list_users` | Unit | Returns paginated user list |
| `test_admin_search_users` | Unit | Search by username returns matching users |
| `test_admin_ban_user` | Unit | User is banned, sessions revoked |
| `test_admin_ban_another_admin` | Unit | Returns 400 (cannot ban admin) |
| `test_admin_ban_requires_reason` | Unit | Ban without reason returns 422 |
| `test_admin_unban_user` | Unit | User is unbanned |
| `test_admin_change_role` | Unit | User admin status changed |
| `test_admin_change_own_role` | Unit | Cannot change own role (400) |
| `test_admin_demote_last_admin` | Unit | Returns 400 |
| `test_admin_stats` | Unit | Returns aggregated stats |
| `test_admin_health` | Unit | Returns health status for all services |
| `test_admin_audit_logs` | Unit | Returns paginated audit logs |
| `test_admin_audit_logs_filter` | Unit | Filter by action returns matching logs |
| `test_audit_log_created_on_ban` | Unit | Ban action creates audit log entry |
| `test_audit_log_created_on_resolve` | Unit | Report resolution creates audit log entry |
| `test_require_admin_middleware` | Unit | Non-admin receives 403 on all admin endpoints |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Admin overview renders | Unit | Stats cards displayed with correct values |
| Admin overview loading | Unit | Skeleton cards during fetch |
| Admin overview error | Unit | Error message with retry |
| Report table displays | Unit | Columns, status badges, pagination |
| Report table filter tabs | Unit | Switching tabs changes status filter |
| Report review workflow | Unit | Action buttons trigger confirmation and API call |
| Report review target preview | Unit | Target content displayed in preview |
| User table search | Unit | Search input filters user list (debounced) |
| Ban user flow | Unit | Confirmation dialog → API call → table updates |
| Ban dialog validation | Unit | Empty reason shows error, min 10 chars enforced |
| Unban user flow | Unit | Confirmation → API call → status changes |
| Role change flow | Unit | Confirm → API call → badge updates |
| Audit log table | Unit | Rows display correct data, filters work |
| Health page indicators | Unit | Service status dots show correct colors, latency shown |
| Health page polling | Unit | Auto-refresh every 30 seconds |
| Admin sidebar nav | Unit | All nav links present, active state correct |
| Non-admin redirect | Unit | Visiting /admin without admin role redirects to / |
| Mobile responsive | Visual | Admin layout adapts at all breakpoints |
| Ban confirmation accessibility | Unit | Dialog has proper ARIA attributes, focus management |

---

## Documentation

- `docs/api.md` — Update with report, admin user management, audit log, stats, health endpoints
- `docs/admin-guide.md` — New document covering admin workflow: how to review reports, ban users, interpret audit logs, understand health indicators
- `docs/milestones/milestone-12.md` — This document

---

## Acceptance Criteria

1. An authenticated user can submit a report against a diary, comment, or user with a reason and optional description.
2. Submitting a duplicate pending report on the same target returns a 409 error.
3. The report queue page lists pending reports with target preview, reporter info, and status.
4. An admin can resolve a report (with optional content removal) or dismiss it, adding a resolution note.
5. Resolving a report with content removal deletes the target diary/comment.
6. The user management page lists all users with search by username.
7. An admin can ban a user with a required reason; banned users cannot log in and their content is hidden.
8. An admin cannot ban another admin.
9. An admin can change a user's role to/from admin.
10. An admin cannot change their own role.
11. An admin cannot demote the last remaining admin.
12. The dashboard stats page shows aggregated counts for users, diaries, interactions, reports, and storage.
13. The health check page shows the status of MongoDB, Redis, and Meilisearch with latency.
14. Every admin action (ban, resolve, role change) is recorded in the audit log with admin identity and timestamp.
15. The audit log viewer supports filtering by action type and date range.
16. Non-admin users receive 403 on all admin endpoints.
17. Non-admin users never see the "Admin Dashboard" nav link.
18. The admin sidebar has working navigation to all admin pages.
19. All admin tests pass (`make test` from backend).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Malicious report spam | Medium | 5/min rate limit per user. Future: trust score threshold for reporters. |
| Admin abuse (rogue admin) | Low | Full audit trail for every action. Cannot delete audit logs. Future: require two-admins for destructive actions. |
| Accidental permanent ban | Low | Unban endpoint exists. Ban dialog requires typed reason. Future: timed bans (suspensions) instead of permanent. |
| Last admin demoted | Low | Server-side check prevents demoting the last admin. |
| Admin account compromised | Low | Use same auth as regular users (MFA in future milestone). Audit trail shows all actions from compromised account for investigation. |
| Stats aggregation slow at scale | Low | Cached in Redis with 5-minute TTL. If needed, pre-compute stats on schedule. |
| Data exposure in target preview | Low | Admin-only endpoints return full content preview. Server-side check ensures only admins access these endpoints. Target preview content is the same as what the admin could view directly. |

---

## Future Considerations

- Milestone 13 adds MinIO file storage which affects the storage stats in the admin dashboard.
- Milestone 15 adds email notifications for report resolution ("Your report has been reviewed").
- Suspension system (timed bans) instead of permanent ban/unban binary.
- Appeals workflow: users can appeal bans or report dismissals.
- Admin activity dashboard: per-admin action counts, response time metrics.
- Automated moderation: flag potentially problematic content using ML/rule-based checks before users report.
- Two-factor authentication for admin accounts (higher security tier).
- Content warnings / NSFW tagging integrated into the reporting workflow.
- Export/archive reports and audit logs for compliance purposes.
- Rate limit dashboard: see which users/endpoints are hitting rate limits most frequently.
- Milestone 16 adds the notification center which could include admin notifications for new reports.
