# Milestone 10 — Explore & Search

## Overview

**Goal:** Users can search and discover public diaries by tags, emotions, date, and full-text search. A dedicated explore page replaces the placeholder with real filtering, browsing, and discovery functionality.

**Purpose:** Discovery is the engine of community growth. DiaryArchive's value increases with every diary a user can find. Without search and browse, users are limited to the homepage feed and random picks. This milestone introduces Meilisearch for full-text search, cached tag/emotion/date browsing, and a unified explore page that combines all discovery paths.

**Dependencies:** Milestone 06 (Public Diaries), Milestone 07 (Rich Text Editor), Milestone 09 (Likes, Bookmarks, Comments)

---

## Architecture Impact

### Backend
- Meilisearch client integration via `meilisearch-python-sdk`
- Dedicated `public_diaries` Meilisearch index with `searchableAttributes`, `filterableAttributes`, `sortableAttributes`
- Real-time indexing hooks on diary create/update/delete (only for public diaries)
- Search endpoint with full-text search, filtering (tags, emotions, year/month, author), pagination, highlighting
- Aggregation-based tag popularity and emotion counts with Redis caching
- Daily re-sync background worker (Celery or APScheduler) to reconcile MongoDB ↔ Meilisearch
- Search result enrichment with author data and stats

### Frontend
- Dedicated explore page (`/explore`) with filter bar, search input, and results grid
- Tag cloud component (clickable, sized by popularity)
- Emotion browser component (emoji buttons with labels and counts)
- Date archive browser (year/month selector for diary archive)
- Debounced search bar component
- "Load More" pagination (consistent with M06 pattern)
- Homepage sections link to explore with pre-applied filters
- Empty states for every search/filter combination

### Database
- No new collections. Tag popularity and emotion counts computed via MongoDB aggregation pipelines.
- New compound index on `diaries` for aggregation queries: `{ privacy: 1, published_at: -1, tags: 1 }`

### API
- 3 new endpoints: search, popular tags, available emotions
- All use the standard `{ data: { ... } }` envelope
- Search results include `_formatted` highlighting fields from Meilisearch

### Search
- Meilisearch becomes a core infrastructure dependency
- Index name: `public_diaries`
- `primaryKey`: `id` (MongoDB ObjectId as string)
- `searchableAttributes`: `["title", "content_text", "tags"]`
- `filterableAttributes`: `["tags", "emotion", "year", "month", "author_id", "created_at"]`
- `sortableAttributes`: `["created_at", "updated_at", "like_count", "comment_count"]`
- Highlighting: `<em>` tags wrapped around matching terms in `title` and `content_text`

### Security
- Search only returns public diaries (privacy filter enforced server-side)
- No banned users' diaries appear in search results
- Rate limiting on search endpoint (30/min per user, 60/min per IP for anonymous)

---

## Features

### F10.1 — Meilisearch Index Configuration (Backend)

**File:** `backend/app/search/config.py`

```python
from meilisearch import Client
from app.core.config import settings

client = Client(settings.MEILISEARCH_URL, settings.MEILISEARCH_MASTER_KEY)

PUBLIC_DIARIES_INDEX = "public_diaries"

INDEX_SETTINGS = {
    "searchableAttributes": ["title", "content_text", "tags"],
    "filterableAttributes": ["tags", "emotion", "year", "month", "author_id", "created_at"],
    "sortableAttributes": ["created_at", "updated_at", "like_count", "comment_count"],
    "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"],
    "highlightPreTag": "<em class='search-highlight'>",
    "highlightPostTag": "</em>",
}

async def initialize_search_indexes():
    """Create or update the Meilisearch index with correct settings."""
    index = client.get_or_create_index(PUBLIC_DIARIES_INDEX, {"primaryKey": "id"})
    index.update_settings(INDEX_SETTINGS)
```

- Called on application startup (FastAPI `lifespan` event)
- Idempotent — safe to call on every restart

### F10.2 — Search Indexing Service (Backend)

**File:** `backend/app/search/indexer.py`

```python
class DiaryIndexer:
    """Handles indexing, updating, and deleting documents in Meilisearch."""

    def __init__(self):
        self.index = client.index(PUBLIC_DIARIES_INDEX)

    async def index_diary(self, diary: dict) -> None:
        """Add or update a diary in the search index."""
        if diary.get("privacy") != "public":
            return  # Only index public diaries
        document = self._build_document(diary)
        await self.index.add_documents([document])

    async def remove_diary(self, diary_id: str) -> None:
        """Remove a diary from the search index."""
        await self.index.delete_document(diary_id)

    async def bulk_index(self, diaries: list[dict]) -> None:
        """Batch index multiple diaries."""
        documents = [self._build_document(d) for d in diaries if d.get("privacy") == "public"]
        if documents:
            await self.index.add_documents(documents)

    def _build_document(self, diary: dict) -> dict:
        return {
            "id": str(diary["_id"]),
            "title": diary["title"],
            "content_text": diary["content_text"],
            "content_html": diary["content_html"],
            "tags": diary.get("tags", []),
            "emotion": diary.get("emotion"),
            "year": diary.get("year"),
            "month": diary.get("month"),
            "author_id": str(diary["user_id"]),
            "created_at": diary["created_at"].isoformat(),
            "updated_at": diary["updated_at"].isoformat(),
            "like_count": diary.get("stats", {}).get("like_count", 0),
            "comment_count": diary.get("stats", {}).get("comment_count", 0),
            "bookmark_count": diary.get("stats", {}).get("bookmark_count", 0),
            "excerpt": diary["content_text"][:300],
        }
```

**F10.2.1 — Indexing Hooks in Diary Service**

**File:** `backend/app/services/diary_service.py` (modified)

Hook calls in existing diary CRUD:

- **Create:** After successful diary creation, if `privacy == "public"`, call `DiaryIndexer.index_diary(doc)`
- **Update:** After successful update, if diary is public, re-index; if privacy changed from public to private, call `DiaryIndexer.remove_diary(id)`
- **Delete:** Before or after deletion, call `DiaryIndexer.remove_diary(id)`

All hooks fire asynchronously (Fire-and-forget via `asyncio.create_task` or background task queue). The endpoint response does not wait for indexing to complete.

### F10.3 — Search Endpoint (Backend)

**File:** `backend/app/api/v1/endpoints/search.py`

**F10.3.1 — GET /api/v1/search**

Full-text search across public diaries with filtering, pagination, and highlighting.

- Auth: Optional (authenticated users get enriched results with `is_liked`, `is_bookmarked`)
- Rate limit: 30/min authenticated, 60/min anonymous

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | `""` | Full-text query (empty = browse all) |
| `tags` | string | — | Comma-separated tag filter (OR logic) |
| `emotion` | string | — | Single emotion filter |
| `year` | int | — | Filter by year |
| `month` | int | — | Filter by month (requires `year`) |
| `sort` | string | `"created_at:desc"` | Sort field and direction (`field:order`) |
| `page` | int | `1` | Page number (1-indexed) |
| `per_page` | int | `20` | Results per page (max 50) |
| `author` | string | — | Filter by username |

**Response:**

```json
{
  "data": [
    {
      "id": "665a2b3c...",
      "title": "A Walk in the Rain",
      "excerpt": "Today I walked in the <em>rain</em> and felt...",
      "content_html": "<p>Today I walked in the <em>rain</em>...</p>",
      "tags": ["life", "weather"],
      "emotion": "hopeful",
      "author": {
        "id": "665a1b2c...",
        "username": "moonwriter",
        "avatar_path": null
      },
      "stats": { "like_count": 3, "comment_count": 1, "bookmark_count": 0 },
      "created_at": "2026-06-25T08:30:00Z",
      "highlights": {
        "title": ["A Walk in the <em>Rain</em>"],
        "content_text": ["Today I walked in the <em>rain</em> and felt..."]
      }
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "has_next": true,
    "has_prev": false,
    "processing_time_ms": 12
  }
}
```

**Implementation logic:**

```python
from app.search.config import client
from app.search.indexer import PUBLIC_DIARIES_INDEX

async def search_diaries(
    q: str = "",
    tags: str | None = None,
    emotion: str | None = None,
    year: int | None = None,
    month: int | None = None,
    sort: str = "created_at:desc",
    page: int = 1,
    per_page: int = 20,
    author_username: str | None = None,
    current_user: dict | None = None,
) -> dict:
    index = client.index(PUBLIC_DIARIES_INDEX)

    # Build filters
    filters = []
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        tag_filters = [f"tags = {t}" for t in tag_list]
        filters.append(f"({' OR '.join(tag_filters)})")
    if emotion:
        filters.append(f"emotion = {emotion}")
    if year:
        filters.append(f"year = {year}")
    if month:
        filters.append(f"month = {month}")
    if author_username:
        # Resolve author_id from username
        author_id = await user_repo.find_id_by_username(author_username)
        if author_id:
            filters.append(f"author_id = {author_id}")

    filter_expression = " AND ".join(filters) if filters else None

    # Parse sort
    sort_field, sort_order = sort.split(":")
    sort_param = [{sort_field: sort_order}]

    # Search
    result = index.search(q or "", {
        "filter": filter_expression,
        "sort": sort_param,
        "page": page,
        "hitsPerPage": per_page,
        "attributesToHighlight": ["title", "content_text"],
        "attributesToCrop": [{"attribute": "content_text", "cropLength": 300}],
    })

    # Enrich with author data, stats, and user flags
    enriched = await enrich_search_results(result["hits"], current_user)

    return {
        "data": enriched,
        "meta": {
            "page": result["page"],
            "per_page": result["hitsPerPage"],
            "total": result["totalHits"],
            "has_next": result["page"] < result["totalPages"],
            "has_prev": result["page"] > 1,
            "processing_time_ms": result["processingTimeMs"],
        },
    }
```

### F10.4 — Popular Tags Endpoint (Backend)

**File:** `backend/app/api/v1/endpoints/tags.py`

**F10.4.1 — GET /api/v1/tags/popular**

Return most-used tags from recent public diaries (last 90 days), cached.

```python
async def get_popular_tags(limit: int = 30, days: int = 90):
    """Aggregate tag usage from recent public diaries, cached in Redis."""
    cache_key = f"tags:popular:{days}:{limit}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    pipeline = [
        {"$match": {"privacy": "public", "created_at": {"$gte": now - timedelta(days=days)}}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
        {"$project": {"tag": "$_id", "count": 1, "_id": 0}},
    ]
    results = await db.diaries.aggregate(pipeline).to_list(limit)
    await redis.setex(cache_key, 300, json.dumps(results))  # 5-minute TTL
    return results
```

**Response:** `{ "data": [ { "tag": "life", "count": 42 }, ... ] }`

### F10.5 — Emotions Endpoint (Backend)

**File:** `backend/app/api/v1/endpoints/emotions.py`

**F10.5.1 — GET /api/v1/emotions**

Return available emotions with diary counts from recent public diaries, cached.

```python
async def get_emotions(days: int = 90):
    cache_key = f"emotions:counts:{days}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    pipeline = [
        {"$match": {"privacy": "public", "emotion": {"$ne": None}, "created_at": {"$gte": now - timedelta(days=days)}}},
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$project": {"emotion": "$_id", "count": 1, "_id": 0}},
    ]
    results = await db.diaries.aggregate(pipeline).to_list(100)
    await redis.setex(cache_key, 300, json.dumps(results))
    return results
```

**Response:** `{ "data": [ { "emotion": "hopeful", "count": 87 }, ... ] }`

### F10.6 — Search Result Enrichment (Backend)

**File:** `backend/app/search/enricher.py`

After Meilisearch returns results, enrich each hit with:
- **Author info:** `username`, `avatar_path` (from `author_id` via MongoDB `$in` batch query)
- **Stats:** `like_count`, `comment_count`, `bookmark_count` (already in doc, but ensure fresh from DB)
- **User flags:** `is_liked`, `is_bookmarked` if authenticated (queried from `likes`/`bookmarks` collections)
- **Full excerpt:** Use `_formatted.content_text` highlighted version, or plain `excerpt` field

```python
async def enrich_search_results(hits: list[dict], current_user: dict | None) -> list[dict]:
    author_ids = list(set(h["author_id"] for h in hits))
    authors = await user_repo.find_by_ids(author_ids)
    author_map = {str(a["_id"]): a for a in authors}

    enriched = []
    for hit in hits:
        author = author_map.get(hit["author_id"], {})
        entry = {
            "id": hit["id"],
            "title": hit.get("_formatted", {}).get("title", hit["title"]),
            "excerpt": hit.get("_formatted", {}).get("content_text", hit.get("excerpt", "")),
            "content_html": hit.get("content_html", ""),
            "tags": hit.get("tags", []),
            "emotion": hit.get("emotion"),
            "author": {
                "id": hit["author_id"],
                "username": author.get("username", "unknown"),
                "avatar_path": author.get("avatar_path"),
            },
            "stats": {
                "like_count": hit.get("like_count", 0),
                "comment_count": hit.get("comment_count", 0),
                "bookmark_count": hit.get("bookmark_count", 0),
            },
            "created_at": hit["created_at"],
            "highlights": {
                "title": hit.get("_formatted", {}).get("title", hit["title"]),
                "content_text": hit.get("_formatted", {}).get("content_text", hit.get("excerpt", "")),
            },
        }
        if current_user:
            entry["is_liked"] = await like_repo.check(hit["id"], str(current_user["_id"]))
            entry["is_bookmarked"] = await bookmark_repo.check(hit["id"], str(current_user["_id"]))
        enriched.append(entry)

    return enriched
```

### F10.7 — Periodic Re-Sync Job (Backend)

**File:** `backend/app/search/sync.py`

A daily background job that performs a full reconciliation of all public diaries from MongoDB to Meilisearch.

```python
async def full_reindex():
    """Re-index all public diaries. Runs daily via Celery/APScheduler."""
    logger.info("Starting full Meilisearch re-index...")
    indexer = DiaryIndexer()

    # Clear existing index
    client.index(PUBLIC_DIARIES_INDEX).delete_all_documents()

    # Batch process all public diaries
    cursor = db.diaries.find(
        {"privacy": "public"},
        projection={...},
        no_cursor_timeout=True
    ).sort("created_at", -1)

    batch = []
    async for diary in cursor:
        batch.append(diary)
        if len(batch) >= 100:
            await indexer.bulk_index(batch)
            batch = []
    if batch:
        await indexer.bulk_index(batch)

    logger.info("Full re-index complete.")
```

- Scheduled for daily execution at 03:00 UTC
- Logs completion with document count
- Health check: compare count between Meilisearch and MongoDB (`db.diaries.count_documents({"privacy": "public"})`)

### F10.8 — Explore Page (Frontend)

**File:** `frontend/src/app/(main)/explore/page.tsx`

The central discovery hub. Replaces the placeholder from M03.

**Layout:**
```
┌────────────────────────────────────────────────┐
│  [SearchBar]  ← full-width, sticky on scroll   │
│  ────────────────────────────────────────────── │
│  [Tag Cloud]  ← clickable tags sized by pop.   │
│  ────────────────────────────────────────────── │
│  [Emotion Browser]  ← emoji buttons with count │
│  ────────────────────────────────────────────── │
│  [Date Archive]  ← year selector + month grid   │
│  ────────────────────────────────────────────── │
│  Active Filters: [tag:life ×] [emotion:❤️ ×]   │
│  "142 results" if query active                  │
│  ────────────────────────────────────────────── │
│  [DiaryCard] [DiaryCard] [DiaryCard]           │
│  [DiaryCard] [DiaryCard] [DiaryCard]           │
│  [     Load More Results   ]                    │
└────────────────────────────────────────────────┘
```

**States:**
- **Default (no query, no filters):** Show latest public diaries. Tag cloud, emotion browser, and date archive visible above results.
- **Search active:** Results grid shows search hits with highlighted terms. Filter browsable sections collapse or scroll out of view.
- **Filter active (tag/emotion/date):** Results filtered. Active filters shown as removable badges above results.
- **Empty results:** "No diaries found" with contextual message and suggestions (try different tags, remove filters, write the first diary in this category).
- **Loading:** Skeleton grid matching the DiaryCardList pattern from M06.
- **Error:** "Couldn't load search results" with retry button.

### F10.9 — Tag Cloud Component (Frontend)

**File:** `frontend/src/components/explore/tag-cloud.tsx`

```tsx
interface TagCloudProps {
  tags: Array<{ tag: string; count: number }>;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  maxTags?: number;
}
```

- Renders tags in a flex-wrap layout
- Each tag is a clickable badge sized by `count` relative to max: small (12px, min opacity), medium (14px), large (16px, max opacity)
- Font size and opacity scale linearly between min and max count
- Selected tags have a filled/accent style
- Empty state: "No tags yet. Tags appear as people write."
- Links to explore with pre-filtered tag when clicked

**Tag sizing formula:**
```
min_size = 0.75rem, max_size = 1.25rem
size = min_size + (count - min_count) / (max_count - min_count) * (max_size - min_size)
opacity = 0.5 + (count - min_count) / (max_count - min_count) * 0.5
```

### F10.10 — Emotion Browser Component (Frontend)

**File:** `frontend/src/components/explore/emotion-browser.tsx`

```tsx
interface EmotionBrowserProps {
  emotions: Array<{ emotion: string; count: number; emoji: string }>;
  selectedEmotion: string | null;
  onSelectEmotion: (emotion: string | null) => void;
}
```

- Grid of emotion buttons: emoji + label + count
- Each button shows: emoji (large, 2rem), emotion name below, count badge
- Selected emotion gets a highlighted/accent border
- "All" button to clear selection
- Uses `EMOTION_MAP` to resolve emoji from emotion key:
  ```typescript
  const EMOTION_MAP: Record<string, { emoji: string; label: string }> = {
    happy: { emoji: "😊", label: "Happy" },
    sad: { emoji: "😢", label: "Sad" },
    hopeful: { emoji: "☁️", label: "Hopeful" },
    reflective: { emoji: "🪞", label: "Reflective" },
    angry: { emoji: "😤", label: "Angry" },
    anxious: { emoji: "😰", label: "Anxious" },
    grateful: { emoji: "🙏", label: "Grateful" },
    excited: { emoji: "🎉", label: "Excited" },
    tired: { emoji: "😴", label: "Tired" },
    loved: { emoji: "💖", label: "Loved" },
  };
  ```
- Empty state: "No emotions recorded yet."

### F10.11 — Date Archive Browser (Frontend)

**File:** `frontend/src/components/explore/date-archive.tsx`

```tsx
interface DateArchiveProps {
  selectedYear: number | null;
  selectedMonth: number | null;
  onSelectDate: (year: number | null, month: number | null) => void;
}
```

- Year selector: horizontal row of year buttons (2024–current year)
- Month grid: when a year is selected, show 12 month buttons with diary counts (optional)
- "All Time" button to clear date filter
- Current year selected by default initially
- Responsive: horizontal scroll on mobile for years

### F10.12 — Search Bar Component (Frontend)

**File:** `frontend/src/components/explore/search-bar.tsx`

```tsx
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}
```

- Text input with search icon on left, clear (×) button on right when value is non-empty
- Debounced onChange input (300ms) — does not fire on every keystroke
- Autofocus on mount (on explore page)
- Loading spinner icon when results are being fetched
- Accessible: `<label>` with `htmlFor`, `aria-label="Search diaries"`
- Keyboard: Enter submits immediately (skips debounce)

### F10.13 — Active Filter Badges (Frontend)

**File:** `frontend/src/components/explore/active-filters.tsx`

```tsx
interface ActiveFiltersProps {
  tags: string[];
  emotion: string | null;
  year: number | null;
  month: number | null;
  onRemoveTag: (tag: string) => void;
  onRemoveEmotion: () => void;
  onRemoveDate: () => void;
  onClearAll: () => void;
}
```

- Row of removable filter badges (tag: "life ×", emotion: "☁️ hopeful ×", date: "June 2026 ×")
- "Clear all" link at the end
- Only shown when at least one filter is active

### F10.14 — Explore Store (Frontend)

**File:** `frontend/src/store/explore-store.ts`

Zustand store for explore page state:

```typescript
interface ExploreState {
  query: string;
  selectedTags: string[];
  selectedEmotion: string | null;
  selectedYear: number | null;
  selectedMonth: number | null;
  sort: string;
  results: SearchResult[];
  total: number;
  page: number;
  hasNext: boolean;
  isLoading: boolean;
  isSearching: boolean;
  setQuery: (q: string) => void;
  toggleTag: (tag: string) => void;
  setEmotion: (emotion: string | null) => void;
  setDate: (year: number | null, month: number | null) => void;
  setSort: (sort: string) => void;
  clearFilters: () => void;
  loadNextPage: () => Promise<void>;
  search: () => Promise<void>;
}
```

### F10.15 — Homepage Update (Frontend)

**File:** `frontend/src/app/(main)/page.tsx` (modified)

Update "Browse by Tags", "Browse by Emotions", "Browse by Year" sections to link to the explore page with pre-applied filters:

- "Browse by Tags" section: Clicking a tag navigates to `/explore?tags=life`
- "Browse by Emotions" section: Clicking an emotion navigates to `/explore?emotion=hopeful`
- "Browse by Year" section: Clicking a year navigates to `/explore?year=2026`

Each section now uses the real TagCloud / EmotionBrowser / DateArchive components (with `interactive={false}` and `linkToExplore` mode) instead of static placeholders.

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   ├── search.py                      # GET /search endpoint
│   ├── tags.py                        # GET /tags/popular endpoint
│   └── emotions.py                    # GET /emotions endpoint
├── search/
│   ├── __init__.py
│   ├── config.py                      # Meilisearch client init, index settings
│   ├── indexer.py                     # DiaryIndexer class (create/update/delete/bulk)
│   ├── enricher.py                    # Search result enrichment (author, flags, stats)
│   └── sync.py                        # Full re-sync background worker
```

### Modified Files (Backend)
```
backend/app/main.py                    # Initialize Meilisearch index on startup
backend/app/api/v1/router.py           # Include search, tags, emotions routers
backend/app/services/diary_service.py  # Add Meilisearch indexing hooks
backend/app/core/config.py             # Add MEILISEARCH_URL, MEILISEARCH_MASTER_KEY
backend/requirements.txt               # Add meilisearch-python-sdk
```

### New Files (Frontend)
```
frontend/src/
├── app/(main)/explore/
│   └── page.tsx                       # Full explore page (replaces placeholder)
├── components/
│   └── explore/
│       ├── search-bar.tsx             # Debounced search input
│       ├── tag-cloud.tsx              # Sized, clickable tag badges
│       ├── emotion-browser.tsx        # Emoji emotion grid with counts
│       ├── date-archive.tsx           # Year/month selector
│       ├── active-filters.tsx         # Removable filter badges
│       └── search-results.tsx         # Results grid with highlight support
├── hooks/
│   └── use-search.ts                  # TanStack Query hook for search
└── store/
    └── explore-store.ts               # Zustand store for explore state
```

### Modified Files (Frontend)
```
frontend/src/app/(main)/page.tsx                  # Wire homepage browse sections to /explore
frontend/src/components/diary/diary-card.tsx      # Add highlight prop for search results
frontend/package.json                             # Add @tanstack/react-query (if not already)
```

---

## Database Changes

### New Indexes
- `diaries` collection: `{ privacy: 1, published_at: -1, tags: 1 }` — supports aggregation queries for tag popularity and emotion counts
- `diaries` collection: `{ privacy: 1, published_at: -1, emotion: 1 }` — supports emotion aggregation

### Migrations
- Run aggregation pipelines on existing data to verify tag/emotion counts
- Full Meilisearch re-index on deployment (one-time)

---

## API Endpoints

| Method | Path | Auth | Rate Limit | Request | Response |
|--------|------|------|-----------|---------|----------|
| GET | `/search` | Optional | 30/min (auth), 60/min (anon) | `q, tags, emotion, year, month, sort, page, per_page, author` | `{ data: [...hits], meta: { page, total, ... } }` |
| GET | `/tags/popular` | Optional | — | `limit, days` | `{ data: [{ tag, count }] }` |
| GET | `/emotions` | Optional | — | `days` | `{ data: [{ emotion, count }] }` |

### Search Request Example
```
GET /api/v1/search?q=rain&tags=life,weather&emotion=hopeful&sort=created_at:desc&page=1&per_page=20
```

### Search Response Full Schema
```json
{
  "data": [
    {
      "id": "665a2b3c4d5e6f7a8b9c0d1e",
      "title": "A Walk in the <em>Rain</em>",
      "excerpt": "Today I walked in the <em>rain</em> and felt the cool drops...",
      "content_html": "<p>Today I walked in the <em>rain</em>...</p>",
      "tags": ["life", "weather"],
      "emotion": "hopeful",
      "author": {
        "id": "665a1b2c...",
        "username": "moonwriter",
        "avatar_path": null
      },
      "stats": {
        "like_count": 3,
        "comment_count": 1,
        "bookmark_count": 0
      },
      "created_at": "2026-06-25T08:30:00Z",
      "highlights": {
        "title": "A Walk in the <em>Rain</em>",
        "content_text": "Today I walked in the <em>rain</em>..."
      }
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "has_next": true,
    "has_prev": false,
    "processing_time_ms": 12
  }
}
```

---

## Frontend

### Pages
- `/explore` — Full explore page with search bar, tag cloud, emotion browser, date archive, and results grid. Replaces the M03 placeholder.

### Components
- `SearchBar` — Debounced text input with search icon, clear button, loading indicator
- `TagCloud` — Flex-wrap tag badges sized by popularity, clickable for filtering
- `EmotionBrowser` — Grid of emotion buttons with emoji, label, and count
- `DateArchive` — Year selector + month grid for date-based browsing
- `ActiveFilters` — Removable filter badges with "Clear all"
- `SearchResults` — Grid of DiaryCards with highlighted search terms

### Hooks
- `useSearch()` — TanStack Query hook wrapping `GET /api/v1/search`, refetches on query/filter/page change. Debounced query input with `keepPreviousData: true` for smooth pagination.
- `usePopularTags()` — TanStack Query hook for `GET /api/v1/tags/popular`, cached/staleTime 5 min
- `useEmotions()` — TanStack Query hook for `GET /api/v1/emotions`, cached/staleTime 5 min

### State Management
- `explore-store.ts` — Zustand store holding current search query, selected filters (tags, emotion, year/month), sort, pagination state. Centralizes filter state so all components stay in sync.

### Routing
- `/explore?q=...&tags=...&emotion=...&year=...&month=...` — URL query params reflect current filters for shareable/bookmarkable URLs
- On mount, parse query params from URL and hydrate store
- On filter change, update URL query params (pushState, no page reload)

### Accessibility
- Search bar: `<label>` with `htmlFor`, `aria-label`, `role="search"`
- Tag cloud: `role="list"` with `role="listitem"` on each tag; tags are `<button>` elements
- Emotion browser: `role="radiogroup"` with `role="radio"` on each emotion button
- Active filters: each badge is a `<button>` with `aria-label="Remove filter: life"`
- Search results: `role="feed"` with `aria-label="Search results"`
- Loading states: `aria-busy="true"` on results container
- Empty states: `role="status"` with polite announcement

### Responsive Design
- Desktop (≥1024px): Tag cloud in full-width row, emotion browser in 5-column grid, results in 3-column grid
- Tablet (768–1023px): Tag cloud in 2-row flex, emotion browser in 4-column grid, results in 2-column grid
- Mobile (<768px): Tag cloud scrolls horizontally, emotion browser in 2-column grid, results in 1-column grid
- Search bar full-width at all breakpoints, sticky on scroll

---

## Backend

### Services
- `search_service.py` — Orchestrates search queries: validates parameters, calls Meilisearch, enriches results, returns paginated response
- `tags_service.py` — Aggregates tag popularity from diaries collection, manages cache
- `emotions_service.py` — Aggregates emotion counts from diaries collection, manages cache

### Business Logic

**Search flow:**
1. Parse and validate query parameters (Pydantic)
2. Build Meilisearch filter expression from tags, emotion, year, month, author
3. Execute search with highlighting, cropping, pagination
4. Enrich results with author data (batch query by author_id)
5. If authenticated, add is_liked/is_bookmarked flags
6. Return paginated response with meta information

**Indexing flow (on diary operations):**
1. Diary created → if public, add document to Meilisearch (async)
2. Diary updated → if public, update document; if privacy changed to private, delete from index
3. Diary deleted → delete document from Meilisearch
4. All indexing operations fire asynchronously; endpoint returns immediately

**Re-sync flow:**
1. Delete all documents in Meilisearch index
2. Fetch all public diaries from MongoDB in batches (100)
3. Add each batch to Meilisearch
4. Log completion and document count
5. Compare total count between Meilisearch and MongoDB (health check)

### Repositories
- `MeilisearchIndex` — Wrapper around Meilisearch client for the public_diaries index (typed methods: `search_diaries`, `add_diary`, `update_diary`, `remove_diary`, `bulk_add`, `clear`)
- Author lookup uses existing `UserRepository.find_by_ids`

### Background Workers
- `full_meilisearch_reindex` — Daily at 03:00 UTC, full reconciliation of MongoDB → Meilisearch
- `index_diary` — Async task triggered by diary create/update/delete (can use `asyncio.create_task` for MVP, migrate to Celery in M14)

---

## Security

### Authentication
- Search endpoint allows anonymous access (public diaries only)
- Authenticated users get enriched results (`is_liked`, `is_bookmarked` flags)
- Rate limiting prevents search abuse / scraping

### Authorization
- Meilisearch index only contains public diaries — no private or draft content ever indexed
- Server-side enrichment enforces privacy: even if a document somehow leaked into the index, only public data is returned
- Admin access to Meilisearch dashboard (if exposed) restricted in production

### Privacy
- Diaries of banned users are excluded from search results (filtered in `enrich_search_results`)
- No user PII indexed in Meilisearch (only `author_id`, not email/username directly)
- Search queries are not logged with user identity (privacy-preserving analytics)

### OWASP Considerations
- Injection: Meilisearch filter expressions are built with parameterized values, not string concatenation. Tags are validated against allowed character set before being used in filters.
- Input validation: All query parameters validated with Pydantic (type coercion, length limits, enum checks)
- Rate limiting: 30/min prevents automated scraping
- Meilisearch exposed only on internal network (not public-facing)

---

## Performance

### Query Patterns
- Meilisearch handles full-text search with sub-10ms response times at expected scale (<100K documents)
- Tag popularity and emotion counts use MongoDB aggregation with compound indexes — sub-50ms
- Redis caching: tags and emotions cached for 5 minutes with TTL
- Search results cached at Redis level for identical queries (optional, 30-second TTL for popular queries)

### Caching Strategy
| Data | Cache | TTL | Invalidation |
|------|-------|-----|-------------|
| Popular tags | Redis | 5 min | Manual on new diary creation (can skip for simplicity) |
| Emotion counts | Redis | 5 min | Manual on new diary creation |
| Search results (page 1, common queries) | Redis | 30 sec | TTL-based expiry |
| Meilisearch index | — | — | Real-time updates via hooks, daily full sync for consistency |

### Indexing Throughput
- Real-time indexing: Single document add/update takes 2-5ms in Meilisearch
- Bulk indexing: 100 documents/batch at ~50ms per batch
- Full re-index of 10K diaries: ~5 seconds
- Indexing operations are async and do not block API responses

### Optimization Notes
- Tag cloud aggregation uses `$match` on `privacy: "public"` and recent date range first (indexed), then `$unwind`/`$group` on a filtered subset
- Emotion aggregation follows the same pattern
- Search pagination uses Meilisearch built-in pagination (not MongoDB skip/limit)
- Author enrichment uses a single `$in` batch query by author_id — no N+1

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_search_fulltext` | Unit | Search by title returns matching diaries |
| `test_search_empty_query` | Unit | Empty query returns all public diaries (paginated) |
| `test_search_filter_tags` | Unit | Tag filter (single and multiple OR) narrows results |
| `test_search_filter_emotion` | Unit | Emotion filter returns only diaries with that emotion |
| `test_search_filter_year_month` | Unit | Year/month filter returns archive-matching diaries |
| `test_search_pagination` | Unit | Page parameter returns correct slice |
| `test_search_highlighting` | Unit | Matched terms wrapped in `<em>` tags |
| `test_search_excludes_private` | Unit | Private/draft diaries never appear in results |
| `test_search_excludes_banned_user` | Unit | Banned users' diaries excluded |
| `test_search_enrichment` | Unit | Author data and stats present in results |
| `test_search_is_liked_flag` | Unit | Authenticated request includes is_liked flag |
| `test_reindex_task` | Unit | Full re-index populates Meilisearch correctly |
| `test_index_on_create` | Unit | Public diary creation triggers indexing |
| `test_index_on_update` | Unit | Diary update re-indexes changed fields |
| `test_index_on_delete` | Unit | Diary deletion removes from index |
| `test_index_privacy_change` | Unit | Public→private removes from index |
| `test_tag_popular` | Unit | Returns top N tags sorted by count |
| `test_tag_popular_cached` | Unit | Repeated calls hit cache |
| `test_emotions` | Unit | Returns emotion counts sorted by count |
| `test_emotions_cached` | Unit | Repeated calls hit cache |
| `test_search_rate_limit` | Integration | Exceeding limit returns 429 |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Explore page renders | Unit | Search bar, tag cloud, emotion browser, date archive, results grid all present |
| Search bar debounce | Unit | onChange fires after 300ms delay (not on every keystroke) |
| Tag cloud click filters | Unit | Clicking tag updates selected tags and triggers search |
| Emotion browser selection | Unit | Clicking emotion filters results |
| Date archive selection | Unit | Selecting year/month filters results |
| Active filters display | Unit | Selected filters shown as removable badges |
| Active filters removal | Unit | Removing a filter updates results |
| Clear all filters | Unit | Clear all resets to unfiltered results |
| Empty search results | Unit | "No diaries found" message with suggestions |
| Loading state | Unit | Skeleton grid during search fetch |
| Error state | Unit | Error message with retry button |
| URL query param sync | Unit | Filter changes update URL; page load reads URL params |
| Tag cloud sizing | Unit | More popular tags render larger |
| Homepage links to explore | Unit | Clicking tag/emotion/year on homepage navigates correctly |
| Search results highlighting | Unit | Matching terms highlighted in results |
| Mobile responsive | Visual | Layout adapts correctly at all breakpoints |
| Keyboard navigation | Manual | Tab through filters, Enter to search, Escape to clear |

---

## Documentation

- `docs/api.md` — Update with search, tags, emotions endpoint details, request/response schemas, error codes
- `docs/search-architecture.md` — New document covering Meilisearch index design, sync strategy, re-index procedure
- `docs/milestones/milestone-10.md` — This document

---

## Acceptance Criteria

1. The explore page at `/explore` renders search bar, tag cloud, emotion browser, date archive, and a results grid.
2. Typing in the search bar returns full-text search results from Meilisearch (debounced 300ms).
3. Search results highlight matching terms with `<em>` tags.
4. Clicking a tag in the tag cloud filters results to that tag (OR logic for multiple tags).
5. Clicking an emotion button filters results to that emotion.
6. Selecting a year and month filters results to that date range.
7. Active filters are shown as removable badges above results; removing a filter updates results.
8. "Load More" pagination loads the next page of results without resetting filters.
9. An empty query with no filters returns all public diaries (paginated by latest).
10. A search with no matches shows "No diaries found" with contextual suggestions.
11. Private/draft diaries never appear in search results.
12. Banned users' diaries never appear in search results.
13. Authenticated users see `is_liked` and `is_bookmarked` flags on search results.
14. The homepage "Browse by Tags", "Browse by Emotions", and "Browse by Year" sections link to the explore page with pre-applied filters.
15. Creating a public diary immediately makes it searchable (within indexing latency).
16. Changing a diary from public to private removes it from search results.
17. Deleting a diary removes it from search results.
18. Popular tags and emotion counts are cached and refresh within 5 minutes.
19. The daily re-sync job completes without errors and logs document count.
20. All search tests pass (`make test` from backend).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Meilisearch service unavailable | Low | Search endpoint degrades gracefully: returns error with message "Search is temporarily unavailable. Please try again." Diary CRUD continues without indexing. Indexing failures are logged and retried. |
| Meilisearch and MongoDB out of sync | Medium | Daily full re-sync reconciles all documents. Indexing hooks provide real-time sync for normal operations. Monitoring alerts on document count mismatch >5%. |
| Search performance degrades at scale | Low | Meilisearch benchmarked at <50ms for 1M documents. If needed, add dedicated search replicas. |
| Tag/emotion aggregation slow on large dataset | Low | Recent date window (90 days) limits aggregation scope. Compound indexes ensure sub-50ms queries. Cache reduces load. |
| Indexing race condition | Low | Diary updates are idempotent in Meilisearch. Concurrent updates to same document are safe. |
| Meilisearch memory usage | Medium | Configure `meilisearch` with appropriate max_index_size and dump/backup settings in docker-compose. Monitor via health endpoint. |

---

## Future Considerations

- Milestone 14 adds cursor-based pagination to search results for deep pagination performance.
- Milestone 16 adds search suggestions / autocomplete (Meilisearch `search` with `limit=5` on focus).
- Advanced filters (date range, word count, popularity threshold) can be added as additional filterable attributes.
- Saved searches / search history can be added as a user preference feature in a future milestone.
- Multi-language search support via Meilisearch's `localizedAttributes` feature.
- Search analytics (popular queries, no-result queries) can inform content strategy and UX improvements.
