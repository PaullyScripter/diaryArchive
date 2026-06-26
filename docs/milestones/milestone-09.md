# Milestone 09 — Social Features

## Overview

**Goal:** Users can comment, like, bookmark, and follow other users. These are the community interaction primitives that enable social engagement on the platform.

**Purpose:** Diary writing is often solitary, but community makes it thrive. Comments let readers respond, likes show appreciation, bookmarks enable personal collections, and following creates a personalized feed. This milestone transforms DiaryArchive from a personal journaling tool into a social platform where writers and readers connect.

**Dependencies:** Milestone 06 (Public Diaries), Milestone 05 (User Profiles), Milestone 07 (Rich Text Editor)

---

## Architecture Impact

### Backend
- Comment CRUD: create, list (paginated), soft-delete with ownership checks
- Like toggle: idempotent create/delete with duplicate prevention
- Bookmark toggle: same pattern as likes
- Follow/unfollow: create/delete with self-follow prevention
- Enrichment endpoints: `is_liked`, `is_bookmarked`, `is_following` flags on diary and user responses
- Atomic `$inc` stats updates on like/comment/bookmark/follow (denormalized counters)
- `comments_enabled`/`comments_locked` checks prevent comments when disabled
- New dedicated collections: `comments`, `likes`, `bookmarks`, `follows`

### Frontend
- Comment section: threaded (flat) list with input, optimistic submit, soft-delete rendering
- Like button: heart icon with count, animated toggle, optimistic update
- Bookmark button: bookmark icon with toggle, optimistic update
- Follow button: Follow/Unfollow toggle on profile pages, optimistic update
- Infinite comment loading: "Load more comments" pagination
- My likes page: grid of liked diaries
- My bookmarks page: grid of bookmarked diaries
- Followers/Following lists: user card lists on profile pages
- Following feed section: homepage section showing followed users' public diaries

### Database
- 4 new collections: `comments`, `likes`, `bookmarks`, `follows`
- Compound unique indexes for likes/bookmarks/follows to enforce idempotency
- Compound indexes for comment listing (diary_id + created_at)
- No schema migrations on existing collections (stats are already on diaries/users)

### API
- 13 new endpoints (comments, likes, bookmarks, follows, enrichment)
- All responses follow the standard `{ "data": { ... } }` envelope
- Paginated endpoints use standard `{ data: [...], meta: { page, per_page, total, has_next, has_prev } }`

### Search
- Comments content is NOT indexed in Meilisearch (M10 scope is diary content only)
- Likes/bookmarks/follows are not searchable (they are personal data)

---

## Features

### F9.1 — Comment CRUD (Backend)

**F9.1.1 — POST /diaries/{id}/comments**

Create a comment on a diary.

- Auth: Bearer access token required
- Check diary exists and is public (or owner can comment on their own diary if privacy allows)
- Check `comments_enabled` and `comments_locked` flags
- Validate: `content` required, 1-2000 characters, plain text (no HTML)
- Set `is_deleted: false`
- Atomic `$inc` diary's `stats.comment_count`
- Response 201: `{ data: { id, content, created_at, author } }`

**F9.1.2 — GET /diaries/{id}/comments**

List comments for a diary.

- Auth: Optional (public diaries allow anyone to read comments)
- Query: `page`, `per_page` (max 50)
- Sorted by `created_at` ascending (oldest first)
- Deleted comments return `{ is_deleted: true, content: null }` — ghost comment placeholder
- Enriched with author info (username, avatar_path)
- Response: `{ data: [comment objects], meta: { page, per_page, total, has_next, has_prev } }`

**F9.1.3 — DELETE /diaries/{id}/comments/{commentId}**

Soft-delete a comment.

- Auth: Bearer access token required
- Authorization: comment author OR diary owner OR admin
- Set `is_deleted: true`, `content: null`, `deleted_at: Date`
- Do NOT decrement `stats.comment_count` (count reflects total comments including deleted)
- Response 204

### F9.2 — Like Toggle (Backend)

**F9.2.1 — POST /diaries/{id}/like**

Toggle like on a diary.

- Auth: Bearer access token required
- Check if like exists:
  - If exists: delete like document, `$inc` diary `stats.like_count` by -1
  - If not exists: create like document, `$inc` diary `stats.like_count` by +1
- Prevent self-like? No — users can like their own diaries
- Response 200: `{ data: { is_liked: true/false, like_count: number } }`
- Return current state (idempotent toggle — calling twice returns to original state)

### F9.3 — Bookmark Toggle (Backend)

**F9.3.1 — POST /diaries/{id}/bookmark**

Toggle bookmark on a diary.

- Auth: Bearer access token required
- Check if bookmark exists:
  - If exists: delete bookmark, `$inc` diary `stats.bookmark_count` by -1
  - If not exists: create bookmark, `$inc` diary `stats.bookmark_count` by +1
- Response 200: `{ data: { is_bookmarked: true/false, bookmark_count: number } }`

### F9.4 — Follow/Unfollow (Backend)

**F9.4.1 — POST /users/{username}/follow**

Toggle follow on a user.

- Auth: Bearer access token required
- Check target user exists and is not banned
- Self-follow prevention: if `username === current_user.username`, return 400
- Check if follow exists:
  - If exists: delete follow, `$inc` target user's `stats.follower_count` by -1, `$inc` current user's `stats.following_count` by -1
  - If not exists: create follow, `$inc` target user's `stats.follower_count` by +1, `$inc` current user's `stats.following_count` by +1
- Response 200: `{ data: { is_following: true/false, follower_count: number } }`

### F9.5 — User's Likes & Bookmarks (Backend)

**F9.5.1 — GET /me/likes**

List diaries the current user has liked.

- Auth: Bearer access token required
- Query: `page`, `per_page`
- Look up like documents for current user, then fetch corresponding diaries
- Response: `{ data: [diary objects], meta: { page, per_page, total, has_next, has_prev } }`

**F9.5.2 — GET /me/bookmarks**

List diaries the current user has bookmarked.

- Auth: Bearer access token required
- Same pattern as likes
- Response: `{ data: [diary objects], meta: { ... } }`

### F9.6 — Follower/Following Lists (Backend)

**F9.6.1 — GET /users/{username}/followers**

List followers of a user.

- Auth: Optional
- Query: `page`, `per_page`
- Enriched with `is_following` (if requesting user is authenticated)
- Response: `{ data: [{ id, username, avatar_path, is_following }], meta: { ... } }`

**F9.6.2 — GET /users/{username}/following**

List users a user is following.

- Auth: Optional
- Same pattern as followers
- Response: `{ data: [{ id, username, avatar_path, is_following }], meta: { ... } }`

### F9.7 — Enrichment (Backend)

**File:** `backend/app/services/enrichment_service.py`

Centralized enrichment logic added to diary and user responses:

```python
async def enrich_diaries(
    diaries: list[dict],
    current_user_id: str | None = None
) -> list[dict]:
    """
    Add is_liked, is_bookmarked, is_owner flags to diary responses.
    Uses batch queries to avoid N+1.
    """
    if not current_user_id:
        for d in diaries:
            d["is_liked"] = False
            d["is_bookmarked"] = False
            d["is_owner"] = False
        return diaries

    diary_ids = [d["_id"] for d in diaries]

    # Batch fetch likes
    like_docs = await likes_repo.find_by_user_and_diary_ids(current_user_id, diary_ids)
    liked_ids = {d["diary_id"] for d in like_docs}

    # Batch fetch bookmarks
    bookmark_docs = await bookmarks_repo.find_by_user_and_diary_ids(current_user_id, diary_ids)
    bookmarked_ids = {d["diary_id"] for d in bookmark_docs}

    for d in diaries:
        d["is_liked"] = d["_id"] in liked_ids
        d["is_bookmarked"] = d["_id"] in bookmarked_ids
        d["is_owner"] = str(d["user_id"]) == current_user_id

    return diaries
```

### F9.8 — Comment Section Component (Frontend)

**File:** `frontend/src/components/social/comment-section.tsx`

```
┌─────────────────────────────────────────────┐
│ Comments (24)                                │
│                                             │
│ ┌─ Comment Input ──────────────────────────┐ │
│ │ [Avatar] [Text input...          ] [Send] │ │
│ └──────────────────────────────────────────┘ │
│                                             │
│ ┌─ Comment ────────────────────────────────┐ │
│ │ [Avatar] moonwriter · 2 hours ago        │ │
│ │ "Beautiful entry! Really resonates."     │ │
│ │ [Delete] (if author or diary owner)       │ │
│ └──────────────────────────────────────────┘ │
│                                             │
│ ┌─ Deleted Comment ────────────────────────┐ │
│ │ "[deleted]"                              │ │
│ └──────────────────────────────────────────┘ │
│                                             │
│ [Load more comments (12 remaining)]         │
└─────────────────────────────────────────────┘
```

Features:
- Text input with avatar, submit button (disabled when empty)
- Optimistic insert: comment appears immediately in list
- Error state: failed comment shows inline error with retry
- Delete: soft-delete shows "[deleted]" placeholder
- Pagination: "Load more comments" button (offset-based)
- Empty state: "No comments yet. Be the first to share your thoughts."
- Comment count in header: "Comments (24)"
- Loading skeleton: 3 placeholder comment rows while fetching
- Max 2000 characters per comment, with character counter below input

### F9.9 — Like Button Component (Frontend)

**File:** `frontend/src/components/social/like-button.tsx`

```tsx
interface LikeButtonProps {
  diaryId: string;
  initialCount: number;
  initialIsLiked: boolean;
}
```

Features:
- Heart icon (outline when not liked, filled red when liked)
- Count display next to icon
- Optimistic toggle: click immediately flips state and updates count
- Animation: heart scales up 1.2x then back to 1x on toggle (CSS keyframe, 200ms)
- On error: revert to previous state (optimistic rollback)
- Disabled during API call (but still shows visual feedback immediately)
- Tooltip: "Like" / "Unlike"
- Accessible: `<button>` with `aria-pressed="true/false"` and `aria-label="Like (n)"`

### F9.10 — Bookmark Button Component (Frontend)

**File:** `frontend/src/components/social/bookmark-button.tsx`

- Bookmark icon (outline / filled)
- Same optimistic toggle pattern as like button
- No count displayed by default (bookmark count is personal; count shown only in diary stats)
- Animation: subtle bounce on toggle
- Tooltip: "Bookmark" / "Remove bookmark"
- Accessible: `aria-pressed` pattern

### F9.11 — Follow Button Component (Frontend)

**File:** `frontend/src/components/social/follow-button.tsx`

```tsx
interface FollowButtonProps {
  username: string;
  initialIsFollowing: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

Features:
- States:
  - Not following: "Follow" (outlined button, primary color)
  - Following: "Following" (filled button, hover shows "Unfollow") — known as "following button pattern"
  - On hover over "Following": text changes to "Unfollow" with red tint
- Optimistic toggle
- Size variant: small (profile list), medium (profile header), large (hero)
- Accessible: `aria-pressed` pattern, label changes dynamically

### F9.12 — My Likes Page (Frontend)

**File:** `frontend/src/app/(main)/me/likes/page.tsx`

- Grid of DiaryCards (same as `/me` diaries)
- Header: "Liked Diaries" with count
- Empty state: "You haven't liked any diaries yet. Explore diaries to find something you love." + Explore button
- Loading: skeleton grid
- Error: retry
- Pagination: "Load more"

### F9.13 — My Bookmarks Page (Frontend)

**File:** `frontend/src/app/(main)/me/bookmarks/page.tsx`

- Same layout as likes page
- Header: "Bookmarked Diaries" with count
- Empty state: "No bookmarks yet. Bookmark diaries you want to read later." + Explore button
- All other states same as likes page

### F9.14 — Followers/Following Lists (Frontend)

**File:** `frontend/src/app/(main)/profile/[username]/page.tsx` (tabs updated)

**Followers tab:**
- Grid of user cards (avatar + username + bio snippet + follow button)
- Paginated: "Load more"
- Empty: "No followers yet."
- If viewing own profile: "You don't have any followers yet. Share your diaries to connect with others."

**Following tab:**
- Same user card layout
- Empty (own profile): "You aren't following anyone yet. Explore diaries to find writers you enjoy."
- Each card shows follow/unfollow button

**User Card Component:** `frontend/src/components/social/user-card.tsx`
```tsx
interface UserCardProps {
  user: { id: string; username: string; avatar_path: string | null; about: string | null };
  isFollowing: boolean;
  onToggleFollow: () => void;
}
```

### F9.15 — Following Feed (Frontend)

**File:** `frontend/src/app/(main)/page.tsx` (updated)

New section on homepage: "From People You Follow"

- Row of DiaryCards (horizontal scroll or 3-column grid)
- Only visible when user is authenticated and following at least one person
- Shows diaries from followed users, sorted by most recent `published_at`
- Empty: "Follow writers to see their diaries here." + Explore link
- Limit to 6 diaries, with "View all" link connecting to a dedicated following feed page (future)
- Section header with avatar group (first 5 followed users' avatars)

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   ├── comments.py                    # Comment CRUD endpoints
│   ├── social.py                      # Like, bookmark, follow endpoints
│   └── me.py                          # /me/likes, /me/bookmarks endpoints
├── repositories/
│   ├── comment_repo.py                # Comment CRUD with pagination
│   ├── like_repo.py                   # Like toggle, batch lookup
│   ├── bookmark_repo.py               # Bookmark toggle, batch lookup
│   └── follow_repo.py                 # Follow/unfollow, list followers/following
├── services/
│   ├── comment_service.py             # Comment business logic
│   ├── social_service.py              # Like/bookmark/follow business logic
│   └── enrichment_service.py          # is_liked/is_bookmarked/is_owner enrichment
└── models/
    ├── comment.py                     # Comment Pydantic models
    └── social.py                      # Like, Bookmark, Follow models
```

### Modified Files (Backend)
```
backend/app/api/v1/router.py           # Include comments, social, me routers
backend/app/services/diary_service.py  # Wire enrichment on diary responses
backend/app/services/user_service.py   # Wire is_following on profile responses
backend/app/core/indexes.py            # Add indexes for new collections
```

### New Files (Frontend)
```
frontend/src/
├── app/(main)/
│   ├── me/
│   │   ├── likes/page.tsx             # Liked diaries page
│   │   └── bookmarks/page.tsx         # Bookmarked diaries page
│   └── diary/[id]/
│       └── page.tsx                   # Updated: wire comment section, like/bookmark buttons
├── components/
│   └── social/
│       ├── comment-section.tsx         # Full comment section with list + input
│       ├── comment-item.tsx            # Single comment (with delete)
│       ├── like-button.tsx             # Heart icon with count and animation
│       ├── bookmark-button.tsx         # Bookmark icon toggle
│       ├── follow-button.tsx           # Follow/unfollow toggle
│       └── user-card.tsx              # User card for follower/following lists
├── hooks/
│   └── use-social.ts                  # TanStack Query hooks for social actions
```

### Modified Files (Frontend)
```
frontend/src/
├── app/(main)/
│   ├── page.tsx                        # Add "Following" feed section
│   ├── profile/[username]/page.tsx     # Wire followers/following tabs, follow button
│   └── diary/[id]/page.tsx            # Wire comment section, like/bookmark buttons
├── components/
│   ├── diary/diary-card.tsx           # Show comment/like counts
│   └── diary/diary-card-list.tsx      # Wire like/bookmark state in cards
├── hooks/
│   └── use-diaries.ts                 # Add social enrichment to diary queries
└── store/
    └── diary-store.ts                  # Track like/bookmark state per diary (optional)
```

---

## Database Changes

### New Collections

**`comments`:**
```javascript
{
  _id: ObjectId,
  diary_id: ObjectId,     // reference to diaries collection
  user_id: ObjectId,      // author
  content: String,        // plain text, 1-2000 chars
  is_deleted: Boolean,    // soft delete
  deleted_at: Date | null,
  created_at: Date,
  updated_at: Date
}
```

**`likes`:**
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  diary_id: ObjectId,
  created_at: Date
}
```

**`bookmarks`:**
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  diary_id: ObjectId,
  created_at: Date
}
```

**`follows`:**
```javascript
{
  _id: ObjectId,
  follower_id: ObjectId,   // user doing the following
  following_id: ObjectId,  // user being followed
  created_at: Date
}
```

### New Indexes

```javascript
// comments
{ "diary_id": 1, "created_at": 1 }            // List comments for a diary
{ "user_id": 1, "created_at": -1 }            // User's comments (admin)

// likes
{ "user_id": 1, "diary_id": 1 }, { unique: true }  // Toggle: one like per user per diary
{ "diary_id": 1 }                                    // Count likes for a diary (optional)

// bookmarks
{ "user_id": 1, "diary_id": 1 }, { unique: true }  // Toggle: one bookmark per user per diary
{ "user_id": 1, "created_at": -1 }                   // User's bookmarks list

// follows
{ "follower_id": 1, "following_id": 1 }, { unique: true }  // Toggle: one follow per pair
{ "following_id": 1, "created_at": -1 }                     // Follower list
{ "follower_id": 1, "created_at": -1 }                      // Following list
```

### Migrations

```javascript
// Add stats fields to diaries that may be missing
db.diaries.updateMany(
  {},
  { $set: { "stats.like_count": 0, "stats.comment_count": 0, "stats.bookmark_count": 0 } }
);
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/diaries/{id}/comments` | Bearer | Create comment |
| GET | `/diaries/{id}/comments` | Optional | List comments (paginated) |
| DELETE | `/diaries/{id}/comments/{commentId}` | Bearer | Soft-delete comment |
| POST | `/diaries/{id}/like` | Bearer | Toggle like |
| POST | `/diaries/{id}/bookmark` | Bearer | Toggle bookmark |
| POST | `/users/{username}/follow` | Bearer | Toggle follow |
| GET | `/me/likes` | Bearer | List liked diaries |
| GET | `/me/bookmarks` | Bearer | List bookmarked diaries |
| GET | `/users/{username}/followers` | Optional | List followers |
| GET | `/users/{username}/following` | Optional | List following |

### Create Comment Request
```json
POST /api/v1/diaries/665a2b3c.../comments
{
  "content": "Beautiful entry! Really resonates with me today."
}
```

### Create Comment Response (201)
```json
{
  "data": {
    "id": "775a2b3c...",
    "content": "Beautiful entry! Really resonates with me today.",
    "author": {
      "id": "665a1b2c...",
      "username": "reader1",
      "avatar_path": null
    },
    "is_deleted": false,
    "created_at": "2026-06-25T10:00:00Z"
  }
}
```

### List Comments Response
```json
{
  "data": [
    {
      "id": "775a2b3c...",
      "content": "Beautiful entry! Really resonates with me today.",
      "author": { "id": "...", "username": "reader1", "avatar_path": null },
      "is_deleted": false,
      "created_at": "2026-06-25T10:00:00Z"
    },
    {
      "id": "885a2b3c...",
      "content": null,
      "author": { "id": "...", "username": "[deleted]", "avatar_path": null },
      "is_deleted": true,
      "created_at": "2026-06-25T09:30:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 50, "total": 2, "has_next": false, "has_prev": false }
}
```

### Like Toggle Response
```json
{
  "data": {
    "is_liked": true,
    "like_count": 13
  }
}
```

### Follow Toggle Response
```json
{
  "data": {
    "is_following": true,
    "follower_count": 42
  }
}
```

---

## Frontend

### Pages
- `/` — Updated: "From People You Follow" section
- `/diary/[id]` — Updated: comment section, like button, bookmark button wired
- `/profile/[username]` — Updated: Followers/Following tabs, follow button in header
- `/me/likes` — Grid of liked diaries
- `/me/bookmarks` — Grid of bookmarked diaries

### Components
- `CommentSection` — Full comment list with input, delete, pagination, states
- `CommentItem` — Single comment rendering (normal, deleted)
- `LikeButton` — Heart icon with count, animated toggle, optimistic update
- `BookmarkButton` — Bookmark icon toggle, optimistic update
- `FollowButton` — Follow/unfollow with hover-to-unfollow pattern, optimistic update
- `UserCard` — Avatar + username + bio + follow button for lists

### Hooks
- `useComments(diaryId)` — TanStack Query for GET /diaries/{id}/comments
- `useCreateComment(diaryId)` — TanStack Query mutation with optimistic add
- `useDeleteComment(diaryId)` — TanStack Query mutation with optimistic removal
- `useToggleLike(diaryId)` — TanStack Query mutation with optimistic toggle
- `useToggleBookmark(diaryId)` — TanStack Query mutation with optimistic toggle
- `useToggleFollow(username)` — TanStack Query mutation with optimistic toggle
- `useMyLikes()` — TanStack Query for GET /me/likes
- `useMyBookmarks()` — TanStack Query for GET /me/bookmarks
- `useFollowers(username)` — TanStack Query for GET /users/{username}/followers
- `useFollowing(username)` — TanStack Query for GET /users/{username}/following

### State Management
- `diary-store.ts` — Optional: cache like/bookmark states for immediate UI response
- Social hooks use TanStack Query cache invalidation on mutation success (e.g., toggling like invalidates diary queries to refresh `is_liked` and `like_count`)

### Routing
- `/me/likes` and `/me/bookmarks` are sub-routes under `/me` (nested layout)
- Comment anchors: after posting a comment, scroll to it via fragment or JS scrollIntoView
- Following feed is embedded in homepage (no separate route yet)

### Accessibility
- Comment input has `<label>` via `aria-label="Write a comment"`
- Submit button: `aria-label="Submit comment"`, disabled with `aria-disabled` when empty
- Like button: `aria-pressed="true/false"`, `aria-label="Like (12) / Unlike (11)"`
- Bookmark button: `aria-pressed="true/false"`, `aria-label="Bookmark / Remove bookmark"`
- Follow button: `aria-pressed="true/false"`, label changes with state
- "Load more comments" button announces loaded count to screen reader
- Deleted comments: rendered as `<span aria-label="Deleted comment">[deleted]</span>`
- Comment list: each comment wrapped in `<article>` with `aria-label="Comment by {username}"`
- Focus management: after posting comment, focus returns to input; after delete, focus moves to next comment

### Responsive Design
- Comment section: full-width below diary content, same max-w-prose constraint
- Comment input: stacks on mobile (avatar above input, submit button right-aligned)
- Likes/Bookmarks pages: 3-column grid → 2-column (tablet) → 1-column (mobile)
- Follower/Following lists: single-column on all sizes, cards are compact
- Follow button: full-width on mobile profile, inline on desktop
- Like/Bookmark buttons: positioned in diary reader action bar, same on all viewports

---

## Backend

### Services
- `comment_service.py`: Create/list/delete with authorization checks, stats updates
- `social_service.py`: Like/bookmark/follow toggle logic with duplicate prevention
- `enrichment_service.py`: Batch enrichment of diary and user responses

### Business Logic

**Create comment:**
1. Verify diary exists and is accessible to user
2. Check `comments_enabled` — 400 if disabled
3. Check `comments_locked` — 400 if locked
4. Sanitize input: strip HTML, max 2000 chars
5. Create comment document
6. Atomic `$inc` diary's `stats.comment_count`
7. Return comment with author enrichment

**Delete comment:**
1. Fetch comment, verify ownership (comment author, diary owner, or admin)
2. Soft-delete: set `is_deleted: true`, `content: null`, `deleted_at: now`
3. Do NOT decrement count (count reflects total comments; deleted comments are ghost entries)

**Toggle like:**
1. Acquire MongoDB session (optional: for atomicity)
2. Check if like document exists for `{ user_id, diary_id }`
3. If exists: delete one, `$inc` like_count by -1
4. If not exists: insert one, `$inc` like_count by +1
5. Return current `is_liked` and `like_count`
6. No duplicate prevention needed — compound unique index prevents duplicates at DB level

**Toggle follow:**
1. Verify target user exists and is not banned
2. Prevent self-follow
3. Same toggle pattern as like
4. Update both follower's and following's stats (two `$inc` operations)

**List comments:**
1. Query comments by `diary_id`, sorted by `created_at` ascending
2. Paginate with skip/limit
3. Enrich with author info via `$lookup` or batch user query
4. Return paginated response

**List followers/following:**
1. Query follows collection (by `following_id` for followers, by `follower_id` for following)
2. Paginate
3. Enrich each user with `is_following` flag (if requesting user is authenticated)
4. Return paginated user list

### Repositories
- `comment_repo.py`: `find_by_diary`, `find_by_id`, `create`, `soft_delete`, `count_by_diary`
- `like_repo.py`: `find_by_user_and_diary`, `find_by_user_and_diary_ids`, `create`, `delete`
- `bookmark_repo.py`: `find_by_user_and_diary`, `find_by_user_and_diary_ids`, `find_by_user_paginated`, `create`, `delete`
- `follow_repo.py`: `find_by_follower_and_following`, `find_followers`, `find_following`, `create`, `delete`

### Background Workers
- `delete_orphaned_likes_bookmarks` — When a diary is deleted, cascade delete associated likes/bookmarks/comments (already handled in diary_service cascade logic from M06)

---

## Security

### Authentication
- All mutating endpoints (comment create, like, bookmark, follow) require Bearer token
- Read-only endpoints (list comments, followers, following) are optionally authenticated

### Authorization
- Comment delete: comment author, diary owner, or admin
- Soft-delete preserves thread context (replies still show [deleted] parent)
- Self-follow prevention (400 error)
- Banned users cannot comment, like, bookmark, or follow
- Private diaries: comments disabled (enforced server-side), likes/bookmarks not applicable

### Privacy
- Comments on public diaries are public (anyone can read them)
- Liked/bookmarked diaries lists are private (only the user can see their own)
- Follower/following lists are public (anyone can view)
- Profile enrichment: `is_following` only shown when the viewer is authenticated

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| POST /diaries/{id}/comments | 10/min per user |
| POST /diaries/{id}/like | 30/min per user |
| POST /diaries/{id}/bookmark | 30/min per user |
| POST /users/{username}/follow | 20/min per user |

### OWASP
- XSS: Comment content is plain text (no HTML allowed; escaped on render)
- CSRF: All mutating endpoints require Bearer token (not cookie-only)
- Mass assignment: Only documented fields accepted via Pydantic
- IDOR: Ownership checks on comment delete, like/bookmark only affect own data
- Rate limiting prevents comment spam and follow spam

---

## Performance

- Like/bookmark/follow toggle uses compound unique index — ultra-fast existence check
- Comment list uses covered query on `{ diary_id, created_at }` index
- Batch enrichment avoids N+1: single query for all likes/bookmarks per diary list
- `$inc` stats updates are atomic and O(1) — no read-modify-write race conditions
- Deep pagination on comments uses skip/limit (acceptable for typical comment counts <500)
- Follower/following lists use paginated indexes — fast even for users with 100k+ followers
- All new collections have appropriate indexes from the start (no missing-index scans)

### Caching Opportunities
- Comment count on diary cards: already denormalized in `stats.comment_count` (no additional query)
- Follower count on profiles: already denormalized in user's `stats.follower_count`
- Following feed: cache for 60 seconds (user's following list changes infrequently)

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_create_comment` | Unit | Creates comment, stats incremented |
| `test_create_comment_diary_not_found` | Unit | Non-existent diary returns 404 |
| `test_create_comment_comments_disabled` | Unit | Diary with comments_enabled=false returns 400 |
| `test_create_comment_comments_locked` | Unit | Locked diary returns 400 |
| `test_create_comment_unauthorized` | Unit | No token returns 401 |
| `test_create_comment_banned_user` | Unit | Banned user returns 403 |
| `test_list_comments` | Unit | Paginated comments returned |
| `test_list_comments_with_deleted` | Unit | Deleted comments show as placeholder |
| `test_delete_comment_author` | Unit | Author can soft-delete own comment |
| `test_delete_comment_diary_owner` | Unit | Diary owner can delete any comment |
| `test_delete_comment_other_user` | Unit | Other user gets 403 |
| `test_toggle_like_add` | Unit | Like added, count incremented |
| `test_toggle_like_remove` | Unit | Like removed, count decremented |
| `test_toggle_like_idempotent` | Unit | Double-toggle returns to original state |
| `test_toggle_bookmark` | Unit | Same idempotent pattern |
| `test_toggle_follow` | Unit | Follow added, stats updated on both users |
| `test_toggle_follow_self` | Unit | Self-follow returns 400 |
| `test_toggle_follow_banned_user` | Unit | Following banned user returns 403 |
| `test_get_my_likes` | Unit | Returns liked diaries for current user |
| `test_get_my_bookmarks` | Unit | Returns bookmarked diaries |
| `test_get_followers` | Unit | Returns follower list with enrichment |
| `test_get_following` | Unit | Returns following list with enrichment |
| `test_enrichment_is_liked` | Unit | Diary response has correct is_liked flag |
| `test_enrichment_is_bookmarked` | Unit | Diary response has correct is_bookmarked flag |
| `test_enrichment_is_following` | Unit | Profile response has correct is_following flag |
| `test_enrichment_batch` | Unit | Batch enrichment fetches all flags in single queries |
| `test_comment_rate_limit` | Integration | Exceeding 10/min returns 429 |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| CommentSection renders | Unit | Comment list + input render with no errors |
| CommentSection empty state | Unit | "No comments yet" shown |
| CommentSection loading | Unit | Skeleton shown while fetching |
| CommentSection error state | Unit | Error message with retry |
| Comment submit optimistic | Integration | Comment appears immediately in list |
| Comment submit failure rollback | Integration | Failed comment removed, error shown |
| Comment delete | Unit | Comment replaced with "[deleted]" |
| LikeButton toggle | Unit | Click flips state, updates count |
| LikeButton animation | Unit | CSS animation class applied on toggle |
| LikeButton optimistic rollback | Integration | Failed toggles revert to previous state |
| BookmarkButton toggle | Unit | Click flips bookmark state |
| FollowButton toggle | Unit | "Follow" → "Following" → "Unfollow" on hover |
| FollowButton animation | Unit | Text transition on hover works |
| My Likes page | Unit | Grid of liked diaries renders |
| My Bookmarks page | Unit | Grid of bookmarked diaries renders |
| My Likes empty | Unit | "No liked diaries" message |
| UserCard renders | Unit | Avatar, username, bio, follow button |
| Followers/Following tabs | Unit | Lists render with user cards |

---

## Documentation

- `docs/api.md` — Update with comments, likes, bookmarks, follows endpoints, all request/response schemas, error codes
- `docs/architecture.md` — Add social interaction data flow diagram
- `docs/milestones/milestone-09.md` — This document
- `docs/database.md` — Update with new collections, indexes, and migration steps

---

## Acceptance Criteria

1. A user can comment on a public diary. The comment appears immediately in the comment section.
2. Comments are plain text only (no HTML). Maximum 2000 characters.
3. The diary owner can delete any comment on their diary. The comment author can also delete their own comment.
4. Deleted comments show as "[deleted]" placeholder.
5. Comments are paginated with "Load more comments".
6. A user can like a diary. The heart icon fills, and the count increments by 1.
7. Liking the same diary again unlikes it (toggle). The count decrements by 1.
8. Like count is consistent across the diary reader page and diary cards.
9. A user can bookmark a diary. The bookmark icon toggles state.
10. Bookmarked diaries appear on `/me/bookmarks`.
11. Liked diaries appear on `/me/likes`.
12. A user can follow another user. The button shows "Following" with a hover-to-unfollow pattern.
13. Self-follow is prevented with an error message.
14. The follower/following lists on profile pages show correct counts and user cards.
15. The homepage shows a "From People You Follow" section with recent diaries from followed users.
16. The `is_liked`, `is_bookmarked`, `is_owner` flags are correctly set in diary API responses.
17. The `is_following` flag is correctly set in user profile API responses (for authenticated viewers).
18. Rate limiting prevents comment spam (10/min).
19. Banned users cannot comment, like, bookmark, or follow.
20. All social feature tests pass (`make test`).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Like/Bookmark duplicate creation (race condition) | Low | Compound unique index prevents duplicates at DB level |
| Comment spam / hate speech | Medium | Rate limiting (10/min), admin moderation in M12, comment reporting in M12 |
| Large follower counts slow profile loading | Low | Paginated follower/following lists with indexed queries; denormalized counts |
| Comment count out of sync | Low | Atomic `$inc` ensures consistency; optional periodic recount job in M14 |
| Like/Bookmark stats on private diaries | Low | Private diaries: comments/likes/bookmarks disabled server-side |
| Follow spam (mass follow/unfollow) | Medium | Rate limiting (20/min), future anti-abuse heuristics |
| N+1 enrichment queries | Low | Batch lookups in enrichment service — single query per flag type |
| Deleted comment thread confusion | Low | Soft-delete preserves thread structure; "[deleted]" is clear enough |

---

## Future Considerations

- Milestone 11 (Notifications) wires into comment, like, follow actions to notify users.
- Milestone 12 (Admin Dashboard) adds comment moderation, abuse report management, and the ability to lock comment threads.
- Milestone 10 adds search — comments are not searchable, but comment counts appear in diary search results.
- Nested (threaded) comments are a future enhancement — this milestone uses flat ordering.
- Comment editing is intentionally excluded from this milestone (MVP is create + delete only).
- Replying to comments (nested threads) is a future milestone.
- "Likes from people you follow" enrichment on diary cards is a future UX enhancement.
- A dedicated "Following" feed page (with full pagination, not just homepage section) is a future enhancement.
- Comment rich text formatting (bold, italic, links) is a future enhancement.
- Emoji reactions (multiple reaction types beyond like) are a future milestone.
- Lists/groups (curated collections of diaries) can be built on top of the bookmark system.
