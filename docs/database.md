# DiaryArchive Database Design

> Status: Draft — v0.1
> DB: MongoDB 7, Driver: Motor (async Python)
> Last updated: 2026-06-25

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Connecting to MongoDB](#2-connecting-to-mongodb)
3. [Collection: users](#3-collection-users)
4. [Collection: diaries](#4-collection-diaries)
5. [Collection: comments](#5-collection-comments)
6. [Collection: likes](#6-collection-likes)
7. [Collection: bookmarks](#7-collection-bookmarks)
8. [Collection: follows](#8-collection-follows)
9. [Collection: notifications](#9-collection-notifications)
10. [Collection: reports](#10-collection-reports)
11. [Collection: audit_logs](#11-collection-audit_logs)
12. [Collection: media](#12-collection-media)
13. [Collection: refresh_tokens](#13-collection-refresh_tokens)
14. [Collection: password_reset_tokens](#14-collection-password_reset_tokens)
15. [Query Patterns & Aggregation Pipelines](#15-query-patterns--aggregation-pipelines)
16. [Performance & Scaling](#16-performance--scaling)
17. [Data Lifecycle](#17-data-lifecycle)

---

## 1. Design Principles

### Embed vs. Reference

| Situation | Decision | Rationale |
|-----------|----------|-----------|
| Diary → Comments | **Reference** | Unbounded growth (comments can be many) |
| Diary → Likes | **Reference** | Unbounded growth |
| User → Diaries | **Reference** | Unbounded growth |
| User → Profile fields | **Embed** | Bounded, always loaded together |
| Diary → Stats | **Embed (denormalize)** | Avoid counting queries; updated atomically |
| Diary → Tags | **Embed** | Bounded array (max 10), always needed |
| User → Followers count | **Embed (denormalize)** | Avoid count queries; eventual consistency OK |

### Denormalization Strategy

Denormalize when:
- The data is read far more often than written.
- Slight inconsistency is acceptable.
- The field is small and frequently needed.

Denormalized fields:
- `diaries.stats.{like_count, comment_count, bookmark_count}` — updated via `$inc` on each action.
- `users.stats.{diary_count, follower_count, following_count}` — updated via `$inc`.

Do NOT denormalize when the write-to-read ratio is high or when consistency is critical.

### Index Design Rules

1. Every query pattern must be supported by an index (verified via `explain()`).
2. Compound indexes follow ESR (Equality → Sort → Range) rule.
3. Fields with high cardinality come first in compound indexes.
4. Indexes on `status`, `read`, `privacy` (boolean/low-cardinality fields) are placed after equality matches on higher-cardinality fields.
5. All indexes are explicitly named for maintainability.
6. Index builds are run in the background in production.

### Schema Versioning

Each document includes a `schema_version` field (integer, starts at 1). This allows the application to handle multiple schema versions during rolling migrations. Migration scripts update documents in batches.

### Write Concerns

| Operation | Write Concern | Rationale |
|-----------|--------------|-----------|
| User registration | `majority` | Must survive failover |
| Diary create/update | `majority` | Core content, must be durable |
| Like/bookmark/follow | `acknowledged` | Acceptable to lose in rare failure |
| Notification | `acknowledged` | Non-critical |
| Count updates (`$inc`) | `acknowledged` | Resync from actual data if needed |
| Audit log | `majority` | Immutable compliance record |

---

## 2. Connecting to MongoDB

### Connection String

```
mongodb://mongodb:27017/diaryarchive?replicaSet=rs0&retryWrites=true&w=majority
```

### Client Configuration

```python
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(
    MONGODB_URI,
    maxPoolSize=100,
    minPoolSize=10,
    maxIdleTimeMS=30000,
    connectTimeoutMS=5000,
    serverSelectionTimeoutMS=5000,
    heartbeatFrequencyMS=10000,
)
db = client.diaryarchive
```

### Replica Set (Production)

A 3-node replica set provides:
- Automatic failover.
- Read scaling (secondary reads for reporting queries).
- Backup via `mongodump` from a secondary node.

---

## 3. Collection: users

### Purpose

Store user accounts, authentication data, optional encrypted email, and public profile information.

### Fields

```
Field                Type        Description
─────────────────────────────────────────────────────────────
_id                  ObjectId    Auto-generated
schema_version      int32       Schema version (starts at 1)

username            string      Unique, lowercase, 3-20 chars,
                                alphanumeric + underscore + hyphen.
                                Immutable after creation.

password_hash       string      Argon2id hash (encoded string
                                containing salt, params, hash).

email_encrypted     string|null AES-256-GCM encrypted email.
                                Base64-encoded: iv:ciphertext:tag.
                                null if no email provided.

email_hash          string|null SHA-256 of normalized email.
                                Used for uniqueness check only.
                                null if no email provided.

email_verified      bool        Whether email has been verified.

avatar_path         string|null Path in MinIO (e.g.,
                                "users/{id}/avatar.webp").

about               string|null Max 500 characters.

favorite_quote      string|null Max 300 characters.

currently_feeling   string|null Max 50 characters.

preferences         object
  .theme            string      "light" | "dark" | "system"
  .comments_disabled bool      Global default for new diaries
  .email_notifications bool   Receive email notifications
  .notify_on_like   bool       (default: true)
  .notify_on_comment bool      (default: true)
  .notify_on_follow  bool      (default: true)
  .notify_on_bookmark bool     (default: false)

stats               object
  .diary_count      int32       Denormalized diary count
  .follower_count   int32       Denormalized follower count
  .following_count  int32       Denormalized following count

encrypted_master_key string|null E2E: master key encrypted with
                                password-derived key. Base64.
                                null until user creates a private diary.

master_key_salt     string|null Salt for PDK derivation. Base64.

is_admin            bool        Admin flag (default: false)

is_banned           bool        Ban flag (default: false)

banned_at           date|null   When the ban was applied

ban_reason          string|null Reason for ban

created_at          date        Account creation timestamp

updated_at          date        Last profile update timestamp

last_login_at       date        Last successful login timestamp
```

### Indexes

```javascript
// 1. Username lookup (login, profile page)
//    Covers: { username: "..." }
{ username: 1 }
// unique: true
// Purpose: Fast login and profile lookup by username.

// 2. Email uniqueness (sparse — only users with email)
//    Covers: { email_hash: "..." } (where email_hash exists)
{ email_hash: 1 }
// unique: true
// sparse: true
// Purpose: Prevent duplicate email registration.
// Sparse because most users won't have an email.

// 3. Admin user search
//    Covers: { username: { $regex: "..." } }
{ username: 1 }
// Already covered by unique index above.

// 4. User listing by join date (admin dashboard)
//    Covers: { created_at: -1 }
{ created_at: -1 }
// Purpose: Admin user list sorted by registration date.
```

### Relationships

- **One-to-many (referenced)**: `users._id` → `diaries.user_id`, `comments.user_id`, `likes.user_id`, etc.
- **Bidirectional**: `users._id` → `follows.follower_id` and `follows.following_id`.

### Example Document

```javascript
{
  _id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  schema_version: 1,
  username: "moonwriter",
  password_hash: "$argon2id$v=19$m=65536,t=3,p=4$...",
  email_encrypted: null,
  email_hash: null,
  email_verified: false,
  avatar_path: "users/665a1b2c/avatar.webp",
  about: "writing my thoughts, one diary at a time",
  favorite_quote: "The unexamined life is not worth living.",
  currently_feeling: "hopeful",
  preferences: {
    theme: "dark",
    comments_disabled: false,
    email_notifications: false,
    notify_on_like: true,
    notify_on_comment: true,
    notify_on_follow: true,
    notify_on_bookmark: false
  },
  stats: {
    diary_count: 24,
    follower_count: 8,
    following_count: 12
  },
  encrypted_master_key: "a5b6c7d8e9f0...",
  master_key_salt: "1a2b3c4d5e6f...",
  is_admin: false,
  is_banned: false,
  banned_at: null,
  ban_reason: null,
  created_at: ISODate("2025-12-01T14:30:00Z"),
  updated_at: ISODate("2026-06-25T10:15:00Z"),
  last_login_at: ISODate("2026-06-25T10:15:00Z")
}
```

### Query Considerations

- **Login**: `findOne({ username: "moonwriter" })` — covered by unique index. Sub-millisecond.
- **Profile**: Same as login.
- **Admin search**: `find({ username: { $regex: "^moon" } }).sort({ created_at: -1 })` — uses the `username` index with regex prefix, then sorts in memory. For larger datasets, use a text index or Meilisearch instead.
- **Stats updates**: `updateOne({ _id: userId }, { $inc: { "stats.diary_count": 1 } })` — atomic, no read needed.

---

## 4. Collection: diaries

### Purpose

Store all diary entries — public, private, and drafts. This is the most complex collection with dual-purpose fields for public content and encrypted private content.

### Fields

```
Field                    Type        Description
──────────────────────────────────────────────────────────────────
_id                     ObjectId    Auto-generated
schema_version          int32       Schema version (starts at 1)

user_id                 ObjectId    Reference to users._id

privacy                 string      "public" | "private" | "draft"

── Public content (used when privacy = "public" or "draft") ──

title                   string|null Rich text or plain. Max 200 chars.
                                    null for private diaries.

content_html            string|null HTML from Tiptap editor.
                                    null for private diaries.

content_text            string|null Plain text extracted from HTML.
                                    Used for Meilisearch indexing and
                                    diary card excerpts.
                                    null for private diaries.

── Private encrypted content (used when privacy = "private") ──

encrypted_data          object|null Encrypted payload
  .iv                   string      96-bit IV, base64
  .salt                 string      256-bit salt, base64
  .ciphertext           string      AES-256-GCM output, base64.
                                    Decrypts to JSON:
                                    { title, content_html, tags }

── Metadata ──

tags                    string[]    Lowercase, max 10 tags.
                                    For private diaries, this field
                                    is always empty [] (tags are
                                    in the encrypted payload).

emotion                 string|null "happy" | "sad" | "anxious" |
                                    "angry" | "excited" | "grateful" |
                                    "lonely" | "hopeful" | "nostalgic" |
                                    "reflective" | "neutral" | null.
                                    null for private diaries.

comments_enabled        bool        Default: true. Public diaries only.

comments_locked         bool        Default: false. When true, no new
                                    comments can be added.

── Denormalized stats ──

stats                   object
  .like_count           int32       Updated via $inc on like/unlike
  .comment_count        int32       Updated via $inc on comment/delete
  .bookmark_count       int32       Updated via $inc on bookmark/unbookmark

── Denormalized archive fields ──

year                    int32       Extracted from created_at for
                                    efficient year-based browsing.
                                    e.g., 2026

month                   int32       Extracted from created_at.
                                    Range: 1-12.

── Timestamps ──

created_at              date        When the diary was first created

updated_at              date        When the diary was last modified

published_at            date|null   When published. null for drafts
                                    and private diaries.
```

### Indexes

```javascript
// 1. Public feed (latest diaries)
//    Covers: { privacy: "public" } sort { created_at: -1 }
{ privacy: 1, created_at: -1 }
// Purpose: Homepage and explore — "Latest Public Diaries".

// 2. Public feed (recently updated)
//    Covers: { privacy: "public" } sort { updated_at: -1 }
{ privacy: 1, updated_at: -1 }
// Purpose: "Recently Updated" section on homepage.

// 3. Public diaries by tag
//    Covers: { privacy: "public", tags: tag } sort { created_at: -1 }
{ privacy: 1, tags: 1, created_at: -1 }
// Purpose: Browse by tag.

// 4. Public diaries by emotion
//    Covers: { privacy: "public", emotion: emotion } sort { created_at: -1 }
{ privacy: 1, emotion: 1, created_at: -1 }
// Purpose: Browse by emotion.

// 5. Public diaries by year/month (archive)
//    Covers: { privacy: "public", year: Y, month: M } sort { created_at: -1 }
{ privacy: 1, year: -1, month: -1, created_at: -1 }
// Purpose: Archive browsing by year and month.

// 6. User's own diaries
//    Covers: { user_id: uid } sort { created_at: -1 }
{ user_id: 1, created_at: -1 }
// Purpose: User's diary list (all privacy levels).

// 7. User's public diaries (profile page)
//    Covers: { user_id: uid, privacy: "public" } sort { created_at: -1 }
{ user_id: 1, privacy: 1, created_at: -1 }
// Purpose: Public profile page showing user's public diaries.

// 8. Random diary lookup
//    Covers: { privacy: "public", _id: { $gte: randomOid } }
{ privacy: 1, _id: 1 }
// Purpose: Efficient random diary selection using ObjectId range.

// 9. Popular diaries
//    Covers: { privacy: "public" } sort { stats.like_count: -1 }
{ privacy: 1, "stats.like_count": -1 }
// Purpose: "Most Liked" or popular diaries section.

// 10. Admin view — all diaries by user (moderation)
{ user_id: 1, created_at: -1 }
// Same as index 6.
```

### Relationships

- **Many-to-one**: `diaries.user_id` → `users._id`
- **One-to-many (referenced)**: `diaries._id` → `comments.diary_id`, `likes.diary_id`, `bookmarks.diary_id`

### Example Documents

**Public Diary:**
```javascript
{
  _id: ObjectId("665a2b3c4d5e6f7a8b9c0d1e"),
  schema_version: 1,
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  privacy: "public",
  title: "A Walk in the Rain",
  content_html: "<p>Today I walked in the rain and felt <em>alive</em>.</p>",
  content_text: "Today I walked in the rain and felt alive.",
  encrypted_data: null,
  tags: ["life", "weather", "reflection"],
  emotion: "hopeful",
  comments_enabled: true,
  comments_locked: false,
  stats: {
    like_count: 12,
    comment_count: 3,
    bookmark_count: 5
  },
  year: 2026,
  month: 6,
  created_at: ISODate("2026-06-25T08:30:00Z"),
  updated_at: ISODate("2026-06-25T08:30:00Z"),
  published_at: ISODate("2026-06-25T08:30:00Z")
}
```

**Private Diary:**
```javascript
{
  _id: ObjectId("665a3b4c5d6e7f8a9b0c1d2e"),
  schema_version: 1,
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  privacy: "private",
  title: null,
  content_html: null,
  content_text: null,
  encrypted_data: {
    iv: "A1B2C3D4E5F6A7B8C9D0E1F2",
    salt: "1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D",
    ciphertext: "F3E4D5C6B7A8..."  // decrypts to:
                                     // { "title": "My Secret",
                                     //   "content_html": "<p>...</p>",
                                     //   "tags": ["personal"] }
  },
  tags: [],
  emotion: null,
  comments_enabled: false,
  comments_locked: false,
  stats: {
    like_count: 0,
    comment_count: 0,
    bookmark_count: 0
  },
  year: 2026,
  month: 6,
  created_at: ISODate("2026-06-24T22:15:00Z"),
  updated_at: ISODate("2026-06-24T22:15:00Z"),
  published_at: null
}
```

**Draft:**
```javascript
{
  _id: ObjectId("665a4b5c6d7e8f9a0b1c2d3e"),
  schema_version: 1,
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  privacy: "draft",
  title: "Unfinished Thoughts",
  content_html: "<p>I've been thinking about...</p>",
  content_text: "I've been thinking about...",
  encrypted_data: null,
  tags: ["draft", "personal"],
  emotion: null,
  comments_enabled: true,
  comments_locked: false,
  stats: { like_count: 0, comment_count: 0, bookmark_count: 0 },
  year: 2026,
  month: 6,
  created_at: ISODate("2026-06-23T19:00:00Z"),
  updated_at: ISODate("2026-06-23T19:45:00Z"),
  published_at: null
}
```

### Query Considerations

#### Public Feed (Latest)

```python
cursor = db.diaries.find(
    {"privacy": "public"},
    sort=[("created_at", -1)],
)
```

- Uses index `privacy: 1, created_at: -1`.
- IXSCAN on `privacy = "public"`, then traverses in `created_at` order.
- No in-memory sort needed.

#### Browse by Tag

```python
cursor = db.diaries.find(
    {"privacy": "public", "tags": "life"},
    sort=[("created_at", -1)],
)
```

- Uses index `privacy: 1, tags: 1, created_at: -1`.
- IXSCAN filters by privacy and tag value, returns documents in creation order.

#### Archive by Year/Month

```python
cursor = db.diaries.find(
    {"privacy": "public", "year": 2026, "month": 6},
    sort=[("created_at", -1)],
)
```

- Uses index `privacy: 1, year: -1, month: -1, created_at: -1`.
- IXSCAN matches exact year and month, returns in creation order.

#### User's Diary List

```python
cursor = db.diaries.find(
    {"user_id": user_id},
    sort=[("created_at", -1)],
)
```

- Uses index `user_id: 1, created_at: -1`.
- IXSCAN on user_id, traverses in creation order.
- Includes all privacy levels (public, private, draft). The application filters private content on the client.

#### Random Diary

```python
import random
from bson import ObjectId

# Generate a random ObjectId
rand_oid = ObjectId()

# Try to find a public diary with _id >= random
diary = await db.diaries.find_one(
    {"privacy": "public", "_id": {"$gte": rand_oid}},
)
# Fallback: if none found, wrap to beginning
if not diary:
    diary = await db.diaries.find_one(
        {"privacy": "public", "_id": {"$lte": rand_oid}},
        sort=[("_id", -1)],
    )
```

- Uses index `privacy: 1, _id: 1`.
- O(log n) — leverages B-tree structure for near-uniform random selection.
- Not perfectly uniform (ObjectId has temporal component), but "random enough" for a diary platform.
- For production: cache the result in Redis for 5 minutes to avoid repeated queries.

#### Aggregation: Following Feed

```python
pipeline = [
    # Get IDs of users the current user follows
    {"$lookup": {
        "from": "follows",
        "let": {"user_id": "$_id"},
        "pipeline": [
            {"$match": {
                "$expr": {"$eq": ["$follower_id", "$$user_id"]}
            }},
            {"$project": {"following_id": 1, "_id": 0}}
        ],
        "as": "following"
    }},
    {"$unwind": "$following"},  // Not ideal — see notes below
    ...
]
```

**Alternative (recommended for MVP): Two queries instead of `$lookup`.**

```python
# Query 1: Get following user IDs
following = await db.follows.find(
    {"follower_id": current_user_id},
    projection={"following_id": 1},
).to_list()

# Query 2: Get their public diaries
diaries = await db.diaries.find(
    {"user_id": {"$in": following_ids}, "privacy": "public"},
    sort=[("created_at", -1)],
    limit=20,
).to_list()
```

- Two simple indexed queries outperform a single complex aggregation.
- Query 1 uses index `follower_id: 1` (on follows collection).
- Query 2 uses index `user_id: 1, privacy: 1, created_at: -1` (on diaries).

---

## 5. Collection: comments

### Purpose

Store comments on public diaries. Comments are plain text (no HTML). Soft-deleted (is_deleted flag) to preserve conversation context.

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

diary_id        ObjectId    Reference to diaries._id
user_id         ObjectId    Reference to users._id (comment author)

content         string      Plain text. Max 2000 chars.
                            Min 1 char.

is_deleted      bool        Soft delete flag. When true,
                            content is replaced with "[deleted]"
                            but the document remains for threading.

created_at      date
updated_at      date
```

### Indexes

```javascript
// 1. Comments for a diary (sorted chronologically)
//    Covers: { diary_id: did } sort { created_at: 1 }
{ diary_id: 1, created_at: 1 }
// Purpose: Load all comments for a diary page.
// Created_at ascending = oldest first.

// 2. User's comment history
//    Covers: { user_id: uid } sort { created_at: -1 }
{ user_id: 1, created_at: -1 }
// Purpose: Show user's recent comments on their profile.
```

### Relationships

- **Many-to-one** with `diaries`: `comments.diary_id` → `diaries._id`
- **Many-to-one** with `users`: `comments.user_id` → `users._id`

### Example Document

```javascript
{
  _id: ObjectId("665b1c2d3e4f5a6b7c8d9e0f"),
  schema_version: 1,
  diary_id: ObjectId("665a2b3c4d5e6f7a8b9c0d1e"),
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0f"),
  content: "This really resonates with me. I had a similar experience last week.",
  is_deleted: false,
  created_at: ISODate("2026-06-25T09:15:00Z"),
  updated_at: ISODate("2026-06-25T09:15:00Z")
}
```

### Query Considerations

- **Loading comments for a diary**: Index scan on `diary_id`, returns in chronological order. O(n) where n = comments per diary. For popular diaries with many comments, consider cursor-based pagination.
- **Counting comments**: Denormalized `diaries.stats.comment_count` avoids a count query on every page load.
- **Soft delete**: `find({ diary_id: did, is_deleted: { $ne: true } })` filters out deleted comments. Add `is_deleted` to the index if filtering is common.

---

## 6. Collection: likes

### Purpose

Record user likes on public diaries. One like per user per diary (enforced by unique compound index).

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

diary_id        ObjectId    Reference to diaries._id
user_id         ObjectId    Reference to users._id (who liked)

created_at      date
```

### Indexes

```javascript
// 1. Unique like (prevent duplicates)
//    Covers: { diary_id: did, user_id: uid }
{ diary_id: 1, user_id: 1 }
// unique: true
// Purpose: Enforce one like per user per diary.

// 2. Likers of a diary
//    Covers: { diary_id: did } sort { created_at: -1 }
{ diary_id: 1, created_at: -1 }
// Purpose: Show who liked a diary.

// 3. Diaries a user has liked
//    Covers: { user_id: uid } sort { created_at: -1 }
{ user_id: 1, created_at: -1 }
// Purpose: "My Likes" page showing user's liked diaries.
```

### Relationships

- **Many-to-one** with `diaries`: `likes.diary_id` → `diaries._id`
- **Many-to-one** with `users`: `likes.user_id` → `users._id`

### Example Document

```javascript
{
  _id: ObjectId("665c1d2e3f4a5b6c7d8e9f0a"),
  schema_version: 1,
  diary_id: ObjectId("665a2b3c4d5e6f7a8b9c0d1e"),
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0f"),
  created_at: ISODate("2026-06-25T10:00:00Z")
}
```

### Query Considerations

- **Toggle like**: Use `findOneAndDelete` if exists, otherwise `insertOne`. The unique compound index prevents accidental double-likes from race conditions.
- **Like count**: Updated via `$inc` on `diaries.stats.like_count` atomically alongside the like insert/delete. Use a `$session` for transactional consistency (optional — eventual consistency is acceptable for like counts).
- **"Is diary liked by current user?"**: Check `findOne({ diary_id: did, user_id: uid })` — uses unique index, sub-millisecond.

---

## 7. Collection: bookmarks

### Purpose

Record user bookmarks on public diaries. Identical structure to likes. Separate collection because bookmarks have different semantics (saving for later vs. appreciation).

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

diary_id        ObjectId    Reference to diaries._id
user_id         ObjectId    Reference to users._id

created_at      date
```

### Indexes

```javascript
// 1. Unique bookmark (prevent duplicates)
{ diary_id: 1, user_id: 1 }
// unique: true

// 2. Bookmarkers of a diary
{ diary_id: 1, created_at: -1 }

// 3. User's bookmarks
{ user_id: 1, created_at: -1 }
```

### Relationships

Same as likes collection.

### Example Document

```javascript
{
  _id: ObjectId("665d1e2f3a4b5c6d7e8f9a0b"),
  schema_version: 1,
  diary_id: ObjectId("665a2b3c4d5e6f7a8b9c0d1e"),
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0f"),
  created_at: ISODate("2026-06-25T11:00:00Z")
}
```

### Query Considerations

All the same considerations as likes. The collections are identical in structure but semantically distinct. This avoids accidentally mixing like/bookmark data and allows them to evolve independently.

---

## 8. Collection: follows

### Purpose

Record follow relationships between users. Directed: Alice follows Bob does not imply Bob follows Alice.

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

follower_id     ObjectId    Reference to users._id (the one who follows)
following_id    ObjectId    Reference to users._id (the one being followed)

created_at      date
```

### Indexes

```javascript
// 1. Unique follow (prevent duplicates)
{ follower_id: 1, following_id: 1 }
// unique: true
// Purpose: One follow per pair.

// 2. Who does this user follow?
{ follower_id: 1, created_at: -1 }
// Purpose: "Following" list on user profile.

// 3. Who follows this user?
{ following_id: 1, created_at: -1 }
// Purpose: "Followers" list on user profile.

// 4. Check if user A follows user B
//    Covers: { follower_id: A, following_id: B }
//    Same compound index as #1.
{ follower_id: 1, following_id: 1 }
```

### Relationships

- **Many-to-many** between users, managed explicitly in this collection.

### Example Document

```javascript
{
  _id: ObjectId("665e1f2a3b4c5d6e7f8a9b0c"),
  schema_version: 1,
  follower_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  following_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0f"),
  created_at: ISODate("2026-06-25T12:00:00Z")
}
```

### Query Considerations

- **Follow/unfollow toggle**: Use `findOneAndDelete` or `insertOne` — same pattern as likes.
- **Following feed (two-query approach)**:
  1. `find({ follower_id: uid }, { following_id: 1 })` — uses index `follower_id: 1`.
  2. `find({ user_id: { $in: following_ids }, privacy: "public" }).sort({ created_at: -1 }).limit(20)` — uses index `user_id: 1, privacy: 1, created_at: -1`.
- **Following count**: Denormalized on `users.stats.following_count` and `users.stats.follower_count`, updated via `$inc`.

---

## 9. Collection: notifications

### Purpose

Deliver notifications to users about activity on their content.

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

user_id         ObjectId    Recipient of the notification

type            string      "like" | "comment" | "follow" | "bookmark"

actor_id        ObjectId    Who triggered the notification
                            Reference to users._id

diary_id        ObjectId|null Optional. Related diary (for like/comment/bookmark)

comment_id      ObjectId|null Optional. Related comment (for comment notification)

read            bool        Default: false

created_at      date        When the action occurred
```

### Indexes

```javascript
// 1. User's notifications (unread first, then by date)
//    Covers: { user_id: uid } sort { read: 1, created_at: -1 }
{ user_id: 1, read: 1, created_at: -1 }
// Purpose: Fetch notifications for the bell icon/dropdown.
// The `read` field has low cardinality, but the sort is on
// `created_at`. MongoDB uses the index to:
//   1. Scan user_id range
//   2. Match read=true or read=false within that range
//   3. Return in created_at order within each read group
// Since we want unread first, the application sorts client-side
// or uses the natural index order (all unread first, then all read).

// 2. Unread count
//    Covers: { user_id: uid, read: false }
{ user_id: 1, read: 1 }
// Purpose: Fast count of unread notifications for the badge.
// The index covers: scan user_id, count read=false docs.
// Full scan avoided — only the user's range is examined.

// 3. Cleanup old notifications (TTL)
{ created_at: 1 }
// expireAfterSeconds: 7776000 (90 days)
// Purpose: Auto-delete notifications older than 90 days.
```

### Relationships

- **Many-to-one** with `users`: `notifications.user_id` → `users._id`
- **Many-to-one** with `users`: `notifications.actor_id` → `users._id`
- **Many-to-one** with `diaries`: `notifications.diary_id` → `diaries._id` (optional)

### Example Document

```javascript
{
  _id: ObjectId("665f1a2b3c4d5e6f7a8b9c0d"),
  schema_version: 1,
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),    // diary owner
  type: "like",
  actor_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0f"),   // person who liked
  diary_id: ObjectId("665a2b3c4d5e6f7a8b9c0d1e"),
  comment_id: null,
  read: false,
  created_at: ISODate("2026-06-25T10:00:00Z")
}
```

### Query Considerations

- **High write volume**: Every like, comment, follow, bookmark creates a notification. At 10k likes/day, that's ~15k notifications/day (aggregating all types). Ensure the `user_id, read, created_at` index fits in working set.
- **Unread badge**: `countDocuments({ user_id: uid, read: false })` — uses index `user_id: 1, read: 1`. Fast even at scale.
- **Batch mark-as-read**: `updateMany({ user_id: uid, read: false }, { $set: { read: true } })` — uses index to find unread notifications efficiently.
- **No self-notifications**: The service layer skips creating notifications where `actor_id === user_id`.

---

## 10. Collection: reports

### Purpose

Store user-submitted reports for manual moderation review.

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

reporter_id     ObjectId    User who submitted the report

target_type     string      "diary" | "comment" | "user"

target_id       ObjectId    The reported entity

reason          string      "harassment" | "illegal_content" |
                            "spam" | "impersonation" |
                            "self_harm" | "other"

description     string|null Free text (max 2000 chars)

status          string      "pending" | "reviewed" |
                            "dismissed" | "action_taken"

reviewed_by     ObjectId|null Admin who handled it

reviewed_at     date|null   When it was reviewed

resolution      string|null Admin notes or resolution details

created_at      date
updated_at      date
```

### Indexes

```javascript
// 1. Report queue (pending first, oldest first)
{ status: 1, created_at: 1 }
// Purpose: Admin dashboard — show pending reports sorted by age.

// 2. User's reports
{ reporter_id: 1, created_at: -1 }
// Purpose: Allow users to see their submitted reports.

// 3. Reports on a specific entity
{ target_type: 1, target_id: 1 }
// Purpose: Check if a specific item has already been reported
// (prevent duplicate reports from the same user — handled in service layer).
```

### Relationships

- **Many-to-one** with `users`: `reports.reporter_id` → `users._id`
- **Many-to-one** with `users`: `reports.reviewed_by` → `users._id` (nullable)
- **Polymorphic reference**: `reports.target_id` could refer to `diaries`, `comments`, or `users`.

### Example Document

```javascript
{
  _id: ObjectId("666a1b2c3d4e5f6a7b8c9d0e"),
  schema_version: 1,
  reporter_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0f"),
  target_type: "diary",
  target_id: ObjectId("665a2b3c4d5e6f7a8b9c0d1e"),
  reason: "harassment",
  description: "This diary contains targeted harassment against another user.",
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  resolution: null,
  created_at: ISODate("2026-06-25T14:00:00Z"),
  updated_at: ISODate("2026-06-25T14:00:00Z")
}
```

### Query Considerations

- **Moderation queue**: `find({ status: "pending" }).sort({ created_at: 1 })` — uses index `status: 1, created_at: 1`. Returns oldest reports first.
- **Admin actions**: When an admin resolves a report, update `status`, `reviewed_by`, `reviewed_at`, `resolution`, and log the action in `audit_logs`. Use a session for transactional consistency.

---

## 11. Collection: audit_logs

### Purpose

Immutable audit trail for all administrative actions. Append-only — documents are never modified or deleted.

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

actor_id        ObjectId    Admin who performed the action

action          string      "user.banned" | "user.unbanned" |
                            "diary.deleted" | "comment.deleted" |
                            "report.reviewed" | "report.dismissed" |
                            "report.action_taken" | "user.role_changed"

target_type     string      "user" | "diary" | "comment" | "report"

target_id       ObjectId|null

details         object      Arbitrary JSON payload with context:
                            { "reason": "...", "previous_status": "..." }

ip_address      string      Admin's IP at time of action

created_at      date
```

### Indexes

```javascript
// 1. Chronological listing (default view)
{ created_at: -1 }
// Purpose: Admin dashboard — recent actions first.

// 2. Actions by a specific admin
{ actor_id: 1, created_at: -1 }
// Purpose: Audit trail for a specific admin.

// 3. Actions on a specific target
{ target_type: 1, target_id: 1, created_at: -1 }
// Purpose: Full history of actions on a specific user/diary/comment.
```

### Relationships

- **Many-to-one** with `users`: `audit_logs.actor_id` → `users._id`

### Example Document

```javascript
{
  _id: ObjectId("666b1c2d3e4f5a6b7c8d9e0f"),
  schema_version: 1,
  actor_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0a"),
  action: "report.action_taken",
  target_type: "report",
  target_id: ObjectId("666a1b2c3d4e5f6a7b8c9d0e"),
  details: {
    "resolution": "Diary deleted, user warned",
    "previous_status": "pending",
    "new_status": "action_taken"
  },
  ip_address: "203.0.113.42",
  created_at: ISODate("2026-06-25T15:00:00Z")
}
```

### Query Considerations

- **Append-only**: Use `insertOne` with `writeConcern: majority` for durability.
- **No updates**: Immutable by design. If a mistake is made, log a corrective entry rather than modifying.
- **Retention**: To be determined by policy (legal may require 1+ year retention).
- **Query volume**: Low — only accessed by admins on the audit log page.

---

## 12. Collection: media

### Purpose

Metadata for all uploaded media files (images, video, audio). The actual files are stored in MinIO/S3/R2.

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

user_id         ObjectId    Uploader

diary_id        ObjectId|null Which diary this media belongs to

filename        string      Original filename (for download/display)

stored_path     string      Path in object store:
                            "users/{user_id}/{uuid}.{ext}"

mime_type       string      "image/jpeg" | "image/webp" |
                            "video/mp4" | "audio/mpeg" | etc.

size_bytes      int32       File size in bytes

width           int32|null  Image/video width (if applicable)

height          int32|null  Image/video height (if applicable)

thumbnail_path  string|null Path to generated thumbnail in object store.
                            "users/{user_id}/{uuid}_thumb.webp"

is_private      bool        True if uploaded for a private diary.
                            Affects URL access (signed URLs vs. public).

created_at      date
```

### Indexes

```javascript
// 1. Media for a diary
{ diary_id: 1 }
// Purpose: Find all media associated with a diary
// (for cleanup on diary deletion).

// 2. User's media
{ user_id: 1, created_at: -1 }
// Purpose: User's media library / upload history.

// 3. Cleanup orphaned media (TTL)
{ created_at: 1 }
// expireAfterSeconds: 604800 (7 days)
// Only applies to documents where diary_id === null
// (uploaded but never attached to a diary).
// Application sets a temporary flag to handle this.
```

### Relationships

- **Many-to-one** with `users`: `media.user_id` → `users._id`
- **Many-to-one** with `diaries`: `media.diary_id` → `diaries._id` (optional)

### Example Document

```javascript
{
  _id: ObjectId("666c1d2e3f4a5b6c7d8e9f0a"),
  schema_version: 1,
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  diary_id: ObjectId("665a2b3c4d5e6f7a8b9c0d1e"),
  filename: "sunset.jpg",
  stored_path: "users/665a1b2c/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
  mime_type: "image/jpeg",
  size_bytes: 2457600,
  width: 1920,
  height: 1080,
  thumbnail_path: "users/665a1b2c/a1b2c3d4-e5f6-7890-abcd-ef1234567890_thumb.webp",
  is_private: false,
  created_at: ISODate("2026-06-25T16:00:00Z")
}
```

### Query Considerations

- **Diary deletion cleanup**: When a diary is deleted, find all associated media, delete files from object store, then delete media documents. Use `$lookup` or a two-query approach.
- **Media URL generation**: URLs are constructed from `stored_path`. For private media, signed URLs with short expiration are generated on the fly (not stored).

---

## 13. Collection: refresh_tokens

### Purpose

Store refresh token hashes for session management. Enables server-side token revocation.

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

user_id         ObjectId    Token owner

token_hash      string      SHA-256 hash of the refresh token

expires_at      date        Token expiration (7 days from creation)

created_at      date
```

### Indexes

```javascript
// 1. Token lookup (login with refresh token)
{ token_hash: 1 }
// unique: true
// Purpose: Find token by hash during refresh.

// 2. Auto-expiry (TTL index)
{ expires_at: 1 }
// expireAfterSeconds: 0
// Purpose: MongoDB automatically removes expired documents.

// 3. Revoke all tokens for a user (password change, ban)
{ user_id: 1 }
// Purpose: Delete all refresh tokens for a specific user.
```

### Relationships

- **Many-to-one** with `users`: `refresh_tokens.user_id` → `users._id`

### Example Document

```javascript
{
  _id: ObjectId("666d1e2f3a4b5c6d7e8f9a0b"),
  schema_version: 1,
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  token_hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
  expires_at: ISODate("2026-07-02T10:00:00Z"),
  created_at: ISODate("2026-06-25T10:00:00Z")
}
```

### Query Considerations

- **Token rotation**: On each refresh, delete the old token hash and insert a new one. This limits the window for token reuse.
- **Bulk revocation on password change**: `deleteMany({ user_id: uid })` — uses index `user_id: 1`.
- **Bulk revocation on ban**: Same as password change.
- **TTL index**: MongoDB automatically purges expired tokens. No cleanup job needed.

---

## 14. Collection: password_reset_tokens

### Purpose

Store password reset tokens (only relevant for users who provided an email).

### Fields

```
Field           Type        Description
────────────────────────────────────────────────
_id             ObjectId
schema_version  int32

user_id         ObjectId    User requesting reset

token_hash      string      SHA-256 hash of the reset token

expires_at      date        Token expiration (1 hour from creation)

used            bool        Whether the token has been consumed

created_at      date
```

### Indexes

```javascript
// 1. Token lookup
{ token_hash: 1 }
// unique: true
// Purpose: Find token by hash during password reset.

// 2. Auto-expiry
{ expires_at: 1 }
// expireAfterSeconds: 0
// Purpose: Auto-delete expired tokens.

// 3. Prevent multiple pending resets for one user
{ user_id: 1, used: false }
// sparse: true
// Purpose: Check if a user already has a pending reset request.
```

### Relationships

- **Many-to-one** with `users`: `password_reset_tokens.user_id` → `users._id`

### Example Document

```javascript
{
  _id: ObjectId("666e1f2a3b4c5d6e7f8a9b0c"),
  schema_version: 1,
  user_id: ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  token_hash: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
  expires_at: ISODate("2026-06-25T11:00:00Z"),
  used: false,
  created_at: ISODate("2026-06-25T10:00:00Z")
}
```

### Query Considerations

- **Single-use tokens**: After successful password reset, set `used: true`. This prevents replay attacks even if the token hash is somehow leaked before expiration.
- **Rate limiting**: Max 1 pending reset per user per hour (enforced by service layer before inserting).

---

## 15. Query Patterns & Aggregation Pipelines

### Pattern 1: Homepage (Latest, Recently Updated, Random)

```javascript
// Latest 20 public diaries
db.diaries.find(
  { privacy: "public" },
  { title: 1, content_text: 1, tags: 1, emotion: 1, stats: 1,
    user_id: 1, created_at: 1 }
).sort({ created_at: -1 }).limit(20)

// Recently updated (last 7 days)
db.diaries.find(
  { privacy: "public", updated_at: { $gt: sevenDaysAgo } }
).sort({ updated_at: -1 }).limit(20)

// Random diary (see Section 4 query considerations)
```

### Pattern 2: User Profile Page

```javascript
// Show user's public diaries (paginated)
db.diaries.find(
  { user_id: userId, privacy: "public" },
  { title: 1, content_text: 1, tags: 1, emotion: 1,
    stats: 1, created_at: 1 }
).sort({ created_at: -1 }).skip(0).limit(20)
```

### Pattern 3: Diary Reader Page

```javascript
// Single diary + author info
const diary = await db.diaries.findOne({ _id: diaryId })

const author = await db.users.findOne(
  { _id: diary.user_id },
  { username: 1, avatar_path: 1, stats: 1 }
)

// Comments for the diary
const comments = await db.comments.find(
  { diary_id: diaryId, is_deleted: { $ne: true } }
).sort({ created_at: 1 }).toArray()

// Enrich comments with author info (N+1 prevention)
const authorIds = [...new Set(comments.map(c => c.user_id))]
const authors = await db.users.find(
  { _id: { $in: authorIds } },
  { username: 1, avatar_path: 1 }
).toArray()
const authorMap = Object.fromEntries(authors.map(a => [a._id, a]))
```

### Pattern 4: User's Private Diaries (Client-Side Decryption)

```javascript
// Fetch all private diaries (metadata only for listing)
const privateDiaries = await db.diaries.find(
  { user_id: userId, privacy: "private" },
  { encrypted_data: 1, created_at: 1, updated_at: 1 }
).sort({ created_at: -1 }).toArray()

// Client decrypts each diary's encrypted_data to display title
```

### Pattern 5: Search Results (Via Meilisearch)

```python
# Meilisearch handles the full-text query
results = await search_client.index("public_diaries").search(query, {
    "filter": ["tags IN [life,travel]"],
    "sort": ["created_at:desc"],
    "limit": 20,
    "offset": 0,
})

# Enrich results with author data
diary_ids = [r.id for r in results.hits]
diaries = await db.diaries.find(
    {"_id": {"$in": diary_ids}},
    {"title": 1, "content_text": 1, "tags": 1, "stats": 1}
).to_list()
```

### Pattern 6: Admin Dashboard Stats

```javascript
// Total users
db.users.countDocuments()

// Total public diaries
db.diaries.countDocuments({ privacy: "public" })

// Reports by status
db.reports.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// Storage usage (total bytes)
db.media.aggregate([
  { $group: { _id: null, totalBytes: { $sum: "$size_bytes" } } }
])
```

### Pattern 7: Mark All Notifications as Read

```javascript
db.notifications.updateMany(
  { user_id: userId, read: false },
  { $set: { read: true, updated_at: new Date() } }
)
```

### Pattern 8: Delete User Account (Cascade)

```javascript
// This requires a transaction for consistency
const session = await client.startSession()
try {
  session.startTransaction()

  // Delete user's diaries
  const userDiaries = await db.diaries.find(
    { user_id: userId },
    { _id: 1 },
    { session }
  ).toArray()
  const diaryIds = userDiaries.map(d => d._id)

  await db.diaries.deleteMany({ user_id: userId }, { session })
  await db.comments.deleteMany({ user_id: userId }, { session })
  await db.comments.deleteMany({ diary_id: { $in: diaryIds } }, { session })
  await db.likes.deleteMany({ user_id: userId }, { session })
  await db.likes.deleteMany({ diary_id: { $in: diaryIds } }, { session })
  await db.bookmarks.deleteMany({ user_id: userId }, { session })
  await db.bookmarks.deleteMany({ diary_id: { $in: diaryIds } }, { session })
  await db.follows.deleteMany({ follower_id: userId }, { session })
  await db.follows.deleteMany({ following_id: userId }, { session })
  await db.notifications.deleteMany({ user_id: userId }, { session })
  await db.notifications.deleteMany({ actor_id: userId }, { session })
  await db.media.deleteMany({ user_id: userId }, { session })
  await db.refresh_tokens.deleteMany({ user_id: userId }, { session })
  await db.users.deleteOne({ _id: userId }, { session })

  await session.commitTransaction()
} finally {
  session.endSession()
}
```

---

## 16. Performance & Scaling

### Index Memory

All recommended indexes should fit in RAM for the working set (10k users, ~1M diaries). Estimated index sizes:

| Collection | Documents (est) | Indexes | Est Index Size |
|------------|----------------|---------|----------------|
| users | 10,000 | 3 | ~2 MB |
| diaries | 1,000,000 | 10 | ~200 MB |
| comments | 3,000,000 | 2 | ~200 MB |
| likes | 5,000,000 | 3 | ~500 MB |
| bookmarks | 1,000,000 | 3 | ~100 MB |
| follows | 100,000 | 4 | ~12 MB |
| notifications | 5,000,000 | 3 | ~400 MB |
| refresh_tokens | 20,000 | 3 | ~3 MB |

Total estimated index size: ~1.5 GB (comfortably fits in 8 GB RAM with room for working set).

### Aggregation Pipeline Optimization

- **Use `$match` as early as possible** to reduce documents flowing through the pipeline.
- **Avoid `$unwind` on large arrays** — if you need to unwind, filter before it.
- **Use `$lookup` cautiously** — at our scale, two queries with `$in` often outperform `$lookup`.
- **Prefer `$sample` over `$rand` + `$sort`** for random selection — `$sample` is optimized for this.

### Write-Heavy Collections

**Likes** and **notifications** are the most write-heavy.

Optimizations:
- Use `$inc` for counter updates (single atomic operation).
- Batch notification inserts where possible.
- Consider write‑concern `acknowledged` (not `majority`) for non-critical writes.
- Index the `created_at` field with TTL on notifications to auto-cleanup old data.

### Pagination Strategy

**MṼP: Skip/Limit**

```python
cursor = db.diaries.find(
    {"privacy": "public"}
).sort("created_at", -1).skip(20).limit(20)
```

Simple but inefficient for deep pages (skip scans all skipped documents).

**Future: Cursor-Based Pagination**

```python
last_id = ObjectId("665a2b3c4d5e6f7a8b9c0d1e")  # ID of last item on page

cursor = db.diaries.find(
    {"privacy": "public", "_id": {"$lt": last_id}}
).sort("_id", -1).limit(20)
```

O(log n) for each page. No skipping. Ideal for infinite-like "Load More" patterns.

### Connection Pooling

- Pool size: 100 connections (default).
- Min pool: 10 connections (keep warm).
- Each FastAPI worker maintains its own pool.
- Monitor `currentOutgoing` to detect connection leaks.

---

## 17. Data Lifecycle

### Document Lifecycle by Collection

| Collection | Create | Read | Update | Delete | Retention |
|------------|--------|------|--------|--------|-----------|
| users | Registration | Profile, auth | Profile edits | Account deletion | Until deleted |
| diaries | User writes | Feed, profile | Edit | User deletes | Until deleted |
| comments | User comments | Diary page | Soft delete | Soft delete | Indefinite (soft) |
| likes | User likes | Diary page | — | Unlike | Until unlike or diary deleted |
| bookmarks | User bookmarks | Bookmarks page | — | Remove bookmark | Until removed |
| follows | User follows | Profile | — | Unfollow | Until unfollowed |
| notifications | Action triggers | Bell icon | Mark read | TTL cleanup | 90 days |
| reports | User reports | Admin queue | Admin resolution | Never | Indefinite |
| audit_logs | Admin action | Admin audit | Never | Never | 1+ year (legal) |
| media | Upload | Diary content | — | Diary delete | Until diary deleted |
| refresh_tokens | Login | Token refresh | — | Logout/expire | 7 days (TTL) |
| password_reset_tokens | Reset request | Reset flow | Mark used | 1 hour (TTL) | 1 hour |

### Migration Strategy

Schema changes use an additive approach:

1. **Add new field** with a default value (code handles both old and new documents).
2. **Run background migration** to update old documents (batch of 1000, with progress tracking).
3. **Remove old field** once all documents are migrated (in a future release).

Migration scripts are stored in `backend/scripts/migrations/` and run via a CLI command.

---

> **Next Steps:**
> 1. Review this database design and provide feedback.
> 2. I recommend we start implementation with the `users` and `diaries` collections first — all other features depend on them.
> 3. The following ADR should be written: `docs/adr/002-mongodb-over-postgres.md` explaining the document model tradeoffs.
