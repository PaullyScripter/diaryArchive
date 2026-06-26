# Milestone 06 — Public Diaries

## Overview

**Goal:** Users can create, read, update, and delete public diary entries. The homepage shows the latest public diaries from all users.

**Purpose:** Public diaries are the core content type of DiaryArchive. This milestone delivers the primary user action (writing and sharing) and the primary browsing experience (reading a feed of public entries). Until this milestone, the application has no user-generated content.

**Dependencies:** Milestone 04 (Authentication), Milestone 05 (User Profiles)

---

## Architecture Impact

### Backend
- Full diary CRUD with ownership checks
- Public feed with filters: sort (latest, updated, popular), tags (OR), emotion, year, month
- Random diary selection via ObjectId range
- HTML sanitization to prevent XSS in diary content
- Denormalized stats updates (like_count, comment_count, bookmark_count) — atomic `$inc`
- Diary repository with all index-aware queries

### Frontend
- DiaryCard component for listings
- DiaryReader page for full content view
- Create/Edit diary pages with forms
- Homepage sections: "Latest Diaries", "Random Diary", "Browse by Tags/Emotions/Year"
- Loading skeletons, empty states, error states
- Zustand store for diary state management

### Database
- `diaries` collection: stores title, content_html, content_text, tags, emotion, privacy, stats, year/month
- All necessary indexes already defined in M02
- No new collections

### API
- 7 new endpoints (list, random, featured, get, create, update, delete)
- All diary responses include author enrichment (username, avatar_path)
- Authenticated viewers get `is_liked`, `is_bookmarked`, `is_owner` flags (flags wired in M09)

### Search
- Public diaries are NOT indexed in Meilisearch yet (M10 adds search)
- For now, browsing uses MongoDB queries with indexes

### Security
- HTML sanitization server-side (strip dangerous tags/attributes)
- Ownership verification for edit/delete
- Banned users cannot create diaries
- Rate limiting on create/update endpoints

---

## Features

### F6.1 — Diary CRUD Endpoints (Backend)

**F6.1.1 — POST /diaries**

Create a new diary entry.

- Auth: Bearer access token required
- Request: `{ privacy ("public"|"draft"), title, content_html, content_text, tags, emotion, comments_enabled }`
- Validation: title max 200 chars, content_html max 100KB, content_text max 50KB, tags max 10 (each 1-30 chars lowercase), emotion must be valid enum value
- Sanitize `content_html` (strip dangerous tags/attributes)
- Set `year` and `month` from `created_at`
- Set `published_at` if privacy is "public"
- Atomic `$inc` user's `stats.diary_count`
- Response 201: `{ data: { id, created_at, message } }`

**F6.1.2 — GET /diaries**

List public diaries with filters.

- Auth: Optional
- Query: `page`, `per_page` (max 100), `sort` (latest, updated, popular), `order` (asc, desc), `tags` (comma-separated OR), `emotion`, `year`, `month`
- Validation: month requires year; if year-month combo has no entries, return empty list
- Response: `{ data: [ { id, title, excerpt (first 200 chars of content_text), author, tags, emotion, stats, is_liked, is_bookmarked, created_at, updated_at, published_at } ], meta: { page, per_page, total, has_next, has_prev } }`

**F6.1.3 — GET /diaries/random**

Get a random public diary.

- Auth: Optional
- Use ObjectId range selection for O(log n) performance
- Cache result in Redis for 5 minutes
- Response: full diary content (same shape as GET /diaries/{id})

**F6.1.4 — GET /diaries/{id}**

Get a single diary entry.

- Auth: Optional (required for private/draft)
- Public diaries: return full content with author enrichment
- Private/draft diaries: only return if requesting user is the owner; otherwise return 404 (ambiguous)
- Enrich with `is_liked`, `is_bookmarked`, `is_owner` if authenticated
- Response: full diary object with author info

**F6.1.5 — PUT /diaries/{id}**

Update a diary entry.

- Auth: Bearer access token required
- Authorization: must be the diary owner (403 otherwise)
- Partial update: only provided fields changed
- Cannot change privacy from public↔private (delete and recreate)
- Re-sanitize content_html if provided
- Update `updated_at`
- Response 200: `{ data: { id, updated_at, message } }`

**F6.1.6 — DELETE /diaries/{id}**

Delete a diary entry and associated data.

- Auth: Bearer access token required
- Authorization: diary owner or admin
- Cascade: delete associated comments, likes, bookmarks (in transactions or separate queries)
- Decrement user's `stats.diary_count`
- Response 204: No content

### F6.2 — HTML Sanitization (Backend)

**File:** `backend/app/core/sanitize.py`

Server-side HTML sanitization to prevent XSS.

- Use `lxml` or `bleach` for HTML parsing and sanitization
- Allowed tags: `p, h1-h6, ul, ol, li, blockquote, pre, code, em, strong, a, img, table, thead, tbody, tr, th, td, hr, br`
- Allowed attributes: `href, src, alt, class, target`
- Strip all `on*` event handlers
- Add `rel="noopener noreferrer"` to all `<a>` tags
- Reject content that exceeds size limits after sanitization

### F6.3 — Diary Card Component (Frontend)

**File:** `frontend/src/components/diary/diary-card.tsx`

The core content unit across the entire site.

```
┌──────────────────────────────────┐
│ [EmotionBadge]  [tags...]        │
│                                  │
│ Title (max 2 lines, truncated)   │
│                                  │
│ Excerpt (max 3 lines, truncated) │
│                                  │
│ Author avatar + name   ♥ 3  💬 5 │
│ 2 hours ago                     │
└──────────────────────────────────┘
```

- Props: diary object, variant (compact/default/detailed)
- States: default, hover (subtle border darkening), loading (skeleton)
- Truncate title and excerpt with CSS (`line-clamp-2`, `line-clamp-3`)
- Format relative timestamps ("2 hours ago")
- Click navigates to `/diary/{id}`

### F6.4 — Diary Card List Component (Frontend)

**File:** `frontend/src/components/diary/diary-card-list.tsx`

- Grid of DiaryCards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Loading state: skeleton cards matching the grid layout
- Empty state: "No diaries yet" with contextual message
- Error state: "Couldn't load diaries" with retry button
- Pagination: "Load More" button at bottom (no infinite scroll)

### F6.5 — Diary Reader Page (Frontend)

**File:** `frontend/src/app/(main)/diary/[id]/page.tsx`

Full diary content view.

```
┌──────────────────────────────────────┐
│   ← Back to explore                  │
│   Author avatar  moonwriter          │
│   Jun 25, 2026  ·  ☁️ hopeful        │
│                                      │
│   # Diary Title (Georgia, bold)      │
│   Body content (Georgia, 1.6 lh)     │
│   Images max-width 100%              │
│                                      │
│   Tags: life  weather  reflection    │
│   ♥ 12  🔖 5  💬 3                  │
│   [Edit] [Delete] (if owner)         │
└──────────────────────────────────────┘
```

- Breadcrumb: Explore > Tag: life > Diary title
- Action buttons: Like (heart), Bookmark, Share (copy link) — wired in M09
- Comments section: placeholder until M09
- Loading: skeleton
- Error: 404/500 handling

### F6.6 — Create/Edit Diary Pages (Frontend)

**File:** `frontend/src/app/(main)/diary/new/page.tsx`
**File:** `frontend/src/app/(main)/diary/[id]/edit/page.tsx`

Basic form-based diary creation (Tiptap integration comes in M07).

**Create page:**
- Title input (text, max 200 chars)
- Content textarea (for M06 MVP — plain text; Tiptap replaces this in M07)
- Tags input (comma-separated, show as removable badges)
- Emotion selector (dropdown of predefined emotions)
- Privacy selector: Public / Draft
- Comments enabled toggle
- Save Draft button + Publish button

**Edit page:**
- Pre-populated with existing content
- Same fields as create
- Delete button (with confirmation dialog)
- "Back to diary" link

### F6.7 — Homepage Sections (Frontend)

Update the homepage (`(main)/page.tsx`) from skeleton to real content:

- "Latest Diaries" section: 3-column grid of DiaryCards from GET /diaries
- "Random Diary" section: a single DiaryCard with "Shuffle" button
- "Browse by Tags" section: tag cloud from GET /tags/popular
- "Browse by Emotion" section: emotion buttons with count
- "Browse by Year" section: year links → explore page

### F6.8 — My Diaries Page (Frontend)

**File:** `frontend/src/app/(main)/me/page.tsx`

Dashboard listing the current user's diaries (all privacy levels).

- Tabs or filter: All / Public / Draft / Private
- Each diary card shows privacy badge
- Private diaries show "Encrypted" instead of title
- Empty state: "No diaries yet. The blank page is waiting." + Write button
- Link to create new diary

### F6.9 — Diary Store (Frontend)

**File:** `frontend/src/store/diary-store.ts`

Zustand store for diary state management:
```typescript
interface DiaryState {
  currentDiary: Diary | null;
  setCurrentDiary: (diary: Diary | null) => void;
  // Future: draft management, autosave state
}
```

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   └── diaries.py                    # Diary CRUD endpoints
├── core/
│   └── sanitize.py                   # HTML sanitization
├── repositories/
│   └── diary_repo.py                 # Diary-specific queries (feed, random, user diaries)
├── services/
│   └── diary_service.py              # Create/update/delete business logic
└── models/
    └── diary.py                      # Pydantic request/response models for diaries
```

### Modified Files (Backend)
```
backend/app/api/v1/router.py          # Include diaries router
```

### New Files (Frontend)
```
frontend/src/
├── app/(main)/
│   ├── diary/
│   │   ├── [id]/
│   │   │   ├── page.tsx              # Diary reader
│   │   │   └── edit/
│   │   │       └── page.tsx          # Diary editor
│   │   └── new/
│   │       └── page.tsx              # Create diary
│   └── me/
│       └── page.tsx                  # My diaries dashboard
├── components/
│   ├── diary/
│   │   ├── diary-card.tsx            # DiaryCard component
│   │   ├── diary-card-list.tsx       # Grid with loading/empty/error states
│   │   └── diary-form.tsx            # Shared create/edit form
│   └── shared/
│       ├── tag-badge.tsx             # Clickable tag badge
│       ├── emotion-badge.tsx         # Emotion with emoji
│       └── privacy-badge.tsx         # Public/Private/Draft badge
├── hooks/
│   └── use-diaries.ts               # TanStack Query hooks for diary CRUD
└── store/
    └── diary-store.ts               # Diary state management
```

### Modified Files (Frontend)
```
frontend/src/app/(main)/page.tsx      # Real data instead of skeletons
frontend/package.json                 # @tanstack/react-query (if not already)
```

---

## Database Changes

No new collections or indexes (all defined in M02).

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/diaries` | Optional | List public diaries (paginated, filtered) |
| GET | `/diaries/random` | Optional | Random public diary |
| GET | `/diaries/{id}` | Optional | Get single diary |
| POST | `/diaries` | Bearer | Create diary |
| PUT | `/diaries/{id}` | Bearer | Update diary (owner only) |
| DELETE | `/diaries/{id}` | Bearer | Delete diary (owner or admin) |
| GET | `/me/diaries` | Bearer | Current user's diaries (all privacy levels) |

### Create Diary Request

```json
{
  "privacy": "public",
  "title": "A Walk in the Rain",
  "content_html": "<p>Today I walked in the rain.</p>",
  "content_text": "Today I walked in the rain.",
  "tags": ["life", "weather"],
  "emotion": "hopeful",
  "comments_enabled": true
}
```

### Diary Response (Public)

```json
{
  "data": {
    "id": "665a2b3c4d5e6f7a8b9c0d1e",
    "privacy": "public",
    "title": "A Walk in the Rain",
    "content_html": "<p>Today I walked in the rain.</p>",
    "author": {
      "id": "665a1b2c...",
      "username": "moonwriter",
      "avatar_path": null
    },
    "tags": ["life", "weather"],
    "emotion": "hopeful",
    "stats": { "like_count": 0, "comment_count": 0, "bookmark_count": 0 },
    "created_at": "2026-06-25T08:30:00Z",
    "updated_at": "2026-06-25T08:30:00Z",
    "published_at": "2026-06-25T08:30:00Z"
  }
}
```

---

## Frontend

### Pages
- `/` — Homepage with live data (Latest Diaries, Random Diary, tags, emotions, years)
- `/diary/new` — Create diary form
- `/diary/{id}` — Diary reader
- `/diary/{id}/edit` — Edit diary form
- `/me` — My diaries dashboard
- `/me/diaries` — (redirect or same as /me with diary filter)
- `/profile/{username}` — Profile page with diary tab (from M05)

### Components
- `DiaryCard` — Core content unit with title, excerpt, author, tags, emotion, stats, timestamp
- `DiaryCardList` — Grid with loading skeletons, empty state, "Load More"
- `DiaryForm` — Shared create/edit form with validation
- `TagBadge` — Clickable tag pill
- `EmotionBadge` — Emotion with emoji display
- `PrivacyBadge` — Public/Draft/Private indicator

### Hooks
- `useDiaries(filters)` — TanStack Query for GET /diaries with filters
- `useDiary(id)` — TanStack Query for GET /diaries/{id}
- `useMyDiaries()` — TanStack Query for GET /me/diaries
- `useCreateDiary()` — TanStack Query mutation
- `useUpdateDiary()` — TanStack Query mutation
- `useDeleteDiary()` — TanStack Query mutation with cache invalidation

### State Management
- `diary-store.ts` — Current diary for edit context, draft tracking (Zustand)

### Accessibility
- Diary reader: semantic `<article>` tag, `<h1>` for title
- All action buttons have ARIA labels
- Timestamps use `<time>` element with `datetime` attribute
- Images in diary content have alt text support
- Loading skeletons use `aria-hidden="true"`

### Responsive Design
- Diary cards: 3-column grid collapses to 2-column (tablet) to 1-column (mobile)
- Diary reader: `max-w-prose` centered for optimal reading, full-width on mobile
- Create/edit form: single column on mobile, wider on desktop

---

## Backend

### Services
- `diary_service.py`: Create, update, delete with ownership verification, stats management, sanitization

### Business Logic

**Create diary:**
1. Validate input (Pydantic)
2. Sanitize content_html (strip dangerous tags)
3. Set year/month from created_at
4. Set published_at if privacy == "public"
5. Insert diary document
6. Increment user's `stats.diary_count`
7. Return diary ID

**Update diary:**
1. Fetch existing diary, verify ownership
2. Validate provided fields
3. Reject privacy change from public↔private
4. Sanitize content_html if provided
5. Update with `$set` (partial update)
6. Return updated_at

**Delete diary:**
1. Verify ownership (or admin status)
2. Delete associated comments
3. Delete associated likes
4. Delete associated bookmarks
5. Delete diary document
6. Decrement user's `stats.diary_count`
7. Return 204

**List public diaries:**
1. Build query filter based on provided parameters
2. Apply sort (using indexes)
3. Paginate with skip/limit
4. Enrich each diary with author info (username, avatar_path)
5. If authenticated, add is_liked/is_bookmarked flags
6. Return paginated response

### Repositories
- `diary_repo.py`: `find_public_feed`, `find_by_tags`, `find_by_emotion`, `find_by_year_month`, `find_random`, `find_user_diaries`, `find_my_diaries`

---

## Security

### Input Validation
- content_html sanitized server-side (tag allowlist, attribute allowlist, event handler removal)
- content_text must be plain text (stripped of HTML)
- Tags: max 10, 1-30 chars each, lowercase, alphanumeric + hyphens only
- Title: max 200 chars
- Emotion: must be valid enum value

### Authorization
- Diary create: user must be authenticated and not banned
- Diary edit/delete: must be the diary owner (check user_id matches JWT sub)
- Admin can delete any diary (for moderation) — wired in M12
- Private/draft diaries: return 404 to non-owners (prevents info leakage)

### Rate Limiting
- POST /diaries: 30 per minute
- PUT /diaries: 30 per minute

### OWASP
- XSS: HTML sanitization on content_html
- CSRF: All mutating endpoints require Bearer token (not cookie-only)
- Mass assignment: Only documented fields are accepted (Pydantic model)
- IDOR: Ownership check on edit/delete prevents accessing other users' diaries

---

## Performance

- Public feed queries use compound indexes (privacy + sort field)
- Random diary uses ObjectId range — O(log n), not O(n) random sort
- Stats are denormalized — no COUNT queries needed
- Pagination uses skip/limit (acceptable for MVP; cursor-based in M14)
- Author enrichment uses a single `find` with `$in` (not N+1 queries)

### Caching Opportunities
- Random diary: cache in Redis for 5 minutes
- Public feed page 1: cache in Redis for 30 seconds (optional)
- Popular tags: cache in Redis for 5 minutes

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_create_public_diary` | Unit | Creates diary, stats incremented |
| `test_create_diary_banned_user` | Unit | Banned user receives 403 |
| `test_get_diary_by_id` | Unit | Returns full diary with author |
| `test_get_diary_not_found` | Unit | Non-existent ID returns 404 |
| `test_get_diary_private_not_owner` | Unit | Private diary returns 404 to other users |
| `test_update_diary_owner` | Unit | Owner can update |
| `test_update_diary_non_owner` | Unit | Non-owner receives 403 |
| `test_delete_diary` | Unit | Diary + associated data deleted, stats decremented |
| `test_list_public_diaries` | Unit | Returns paginated results sorted by latest |
| `test_list_diaries_filter_tags` | Unit | Filter by single/multiple tags |
| `test_list_diaries_filter_emotion` | Unit | Filter by emotion |
| `test_list_diaries_filter_year_month` | Unit | Filter by year/month archive |
| `test_random_diary` | Unit | Returns a public diary |
| `test_html_sanitization` | Unit | Dangerous tags/attributes stripped |
| `test_diary_xss_prevention` | Unit | Script tags removed from content |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| DiaryCard renders | Unit | All fields displayed correctly |
| DiaryCard truncation | Unit | Long titles/excerpts truncated |
| DiaryCardList loading | Unit | Skeleton cards shown during loading |
| DiaryCardList empty | Unit | "No diaries" message on empty |
| DiaryCardList error | Unit | Error message with retry |
| DiaryReader renders | Unit | Full content displayed |
| DiaryForm validation | Unit | Required fields, max lengths enforced |
| Create diary flow | Integration | Form submission → API call → redirect to reader |
| My Diaries page | Unit | Lists user's diaries with privacy badges |

---

## Documentation

- `docs/api.md` — Update with diary endpoints, request/response schemas, error codes
- `docs/milestones/milestone-06.md` — This document

---

## Acceptance Criteria

1. A user can create a public diary with title, content, tags, emotion, and comments toggle.
2. The created diary appears on the homepage "Latest Diaries" section.
3. The diary reader page displays the full content with author info and metadata.
4. The diary owner can edit the diary; changes persist after save.
5. The diary owner can delete the diary; it disappears from all listings.
6. Non-owners cannot edit or delete another user's diary.
7. The public feed supports pagination with "Load More".
8. The public feed can be filtered by tags (OR logic), emotion, and year/month.
9. The random diary endpoint returns a different diary each time.
10. Draft diaries are visible only to the author.
11. Banned users cannot create diaries.
12. HTML content is sanitized: `<script>`, `onclick`, and dangerous tags are stripped.
13. The homepage shows live data (not skeletons) when diaries exist.
14. The "My Diaries" page shows the user's own diaries with privacy badges.
15. All diary CRUD tests pass (`make test`).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| HTML injection via content | Low | Server-side sanitization with strict allowlist |
| Large diary content (100KB+) | Low | Size limits enforced before and after sanitization |
| Delete cascade failure | Low | Use MongoDB transactions or sequential deletes with error handling |
| Feed page deep pagination slow | Medium | Skip/limit degrades at deep pages; cursor-based pagination in M14 |
| Race condition on stats update | Low | Atomic `$inc` operations are safe under concurrent access |

---

## Future Considerations

- Milestone 07 replaces the plain-text diary form with the Tiptap rich text editor.
- Milestone 09 adds likes, bookmarks, and comments to diary pages.
- Milestone 10 adds Meilisearch integration for full-text search.
- Milestone 08 adds private diaries with client-side encryption.
- The `is_liked`/`is_bookmarked` flags are included in responses from M06 but always return false until M09 wires them.
- Comment count on diary cards will show 0 until M09.
