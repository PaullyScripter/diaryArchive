# DiaryArchive REST API

> Version: v1
> Base URL: `/api/v1`
> Last updated: 2026-06-25

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Users & Profiles](#3-users--profiles)
4. [My Account](#4-my-account)
5. [Diaries](#5-diaries)
6. [Comments](#6-comments)
7. [Likes](#7-likes)
8. [Bookmarks](#8-bookmarks)
9. [Follows](#9-follows)
10. [Notifications](#10-notifications)
11. [Search](#11-search)
12. [Media](#12-media)
13. [Reports](#13-reports)
14. [Tags & Emotions](#14-tags--emotions)
15. [Admin](#15-admin)
16. [Error Codes](#16-error-codes)

---

## 1. Conventions

### Response Envelope

**Single resource:**
```json
{
  "data": { ... }
}
```

**Collection:**
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "has_next": true,
    "has_prev": false
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "validation_error",
    "message": "Username must be between 3 and 20 characters",
    "details": [
      { "field": "username", "message": "String should have at least 3 characters" }
    ]
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete, logout, etc.) |
| 400 | Bad Request |
| 401 | Unauthorized (missing or invalid auth) |
| 403 | Forbidden (authenticated but not permitted) |
| 404 | Not Found |
| 409 | Conflict (duplicate username/email) |
| 413 | Payload Too Large (file upload) |
| 415 | Unsupported Media Type |
| 422 | Validation Error |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### Pagination

All collection endpoints support:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | 1-indexed page number |
| `per_page` | int | 20 | Items per page (max 100) |

### Authentication Header

Authenticated requests include:
```
Authorization: Bearer <access_token>
```

### Date Format

All dates use ISO 8601: `2026-06-25T14:30:00Z`

### IDs

All IDs use MongoDB ObjectId hex strings (24 characters): `"665a1b2c3d4e5f6a7b8c9d0e"`

---

## 2. Authentication

### POST /api/v1/auth/register

Create a new account.

**Auth:** None
**Rate limit:** 5 per minute per IP

**Request body:**
```json
{
  "username": "moonwriter",
  "password": "correct-horse-battery-staple",
  "email": null
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `username` | Required. 3-20 chars. Regex: `^[a-zA-Z0-9_-]+$`. Case-insensitive (stored lowercase). |
| `password` | Required. 8-128 chars. Must contain at least one letter and one digit. |
| `email` | Optional. Valid email format if provided. Max 254 chars. |

**Success (201):**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "moonwriter",
    "created_at": "2026-06-25T14:30:00Z",
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```
**Set-Cookie:** `refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800`

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `username_taken` | 409 | Username already registered |
| `email_taken` | 409 | Email already associated with another account |
| `validation_error` | 422 | Invalid field values |
| `rate_limited` | 429 | Too many requests |

---

### POST /api/v1/auth/login

Authenticate and receive tokens.

**Auth:** None
**Rate limit:** 10 per minute per IP

**Request body:**
```json
{
  "username": "moonwriter",
  "password": "correct-horse-battery-staple"
}
```

**Success (200):**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "moonwriter",
    "is_admin": false,
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```
**Set-Cookie:** `refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800`

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `invalid_credentials` | 401 | Wrong username or password |
| `account_banned` | 403 | User account is banned |
| `validation_error` | 422 | Missing/invalid fields |
| `rate_limited` | 429 | Too many attempts |

---

### POST /api/v1/auth/refresh

Exchange a refresh token for a new access token.

**Auth:** Refresh token cookie
**Rate limit:** 20 per minute per IP

**Cookie:**
```
refresh_token=<token>
```

**Success (200):**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```
**Set-Cookie:** `refresh_token=<new_token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800`
(The refresh token is rotated — old one is revoked.)

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `invalid_token` | 401 | Refresh token missing, expired, or revoked |
| `account_banned` | 403 | User account is banned |
| `rate_limited` | 429 | Too many requests |

---

### POST /api/v1/auth/logout

Invalidate the current refresh token.

**Auth:** Bearer access token

**Cookie:**
```
refresh_token=<token>
```

**Success (204):** No content.
**Set-Cookie:** `refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=0` (clears cookie)

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |

---

### GET /api/v1/auth/me

Get the currently authenticated user's full profile.

**Auth:** Bearer access token

**Success (200):**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "moonwriter",
    "avatar_path": "users/665a1b2c/avatar.webp",
    "about": "writing my thoughts, one diary at a time",
    "favorite_quote": "The unexamined life is not worth living.",
    "currently_feeling": "hopeful",
    "has_email": true,
    "email_verified": true,
    "preferences": {
      "theme": "dark",
      "comments_disabled": false,
      "email_notifications": false,
      "notify_on_like": true,
      "notify_on_comment": true,
      "notify_on_follow": true,
      "notify_on_bookmark": false
    },
    "stats": {
      "diary_count": 24,
      "follower_count": 8,
      "following_count": 12
    },
    "is_admin": false,
    "created_at": "2025-12-01T14:30:00Z",
    "last_login_at": "2026-06-25T10:15:00Z"
  }
}
```

**Note:** `has_email` is a boolean (we never expose the actual email address).

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |

---

### PUT /api/v1/auth/change-password

Change the current user's password. On success, all existing refresh tokens are revoked (user must log in again on other devices).

**Auth:** Bearer access token

**Request body:**
```json
{
  "current_password": "old-password",
  "new_password": "new-correct-horse-battery-staple"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `current_password` | Required. Must match current password hash. |
| `new_password` | Required. 8-128 chars. Must contain at least one letter and one digit. Must differ from current password. |

**Success (200):**
```json
{
  "data": {
    "message": "Password changed successfully. Please log in again on other devices."
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `incorrect_password` | 400 | Current password is wrong |
| `validation_error` | 422 | Invalid new password |

---

### POST /api/v1/auth/request-password-reset

Send a password reset link to the user's email. Only works for users who registered with an email.

**Auth:** None
**Rate limit:** 3 per hour per email

**Request body:**
```json
{
  "username": "moonwriter"
}
```

**Success (200):**
```json
{
  "data": {
    "message": "If this account has an email, a reset link has been sent."
  }
}
```
Always returns 200 (even if the username doesn't exist or has no email) to prevent username enumeration.

---

### POST /api/v1/auth/reset-password

Reset password using a token from the email link.

**Auth:** None
**Rate limit:** 5 per hour per token

**Request body:**
```json
{
  "token": "reset-token-from-email",
  "new_password": "new-correct-horse-battery-staple"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `token` | Required. Must be a valid, unexpired, unused reset token. |
| `new_password` | Required. 8-128 chars. Must contain at least one letter and one digit. |

**Success (200):**
```json
{
  "data": {
    "message": "Password reset successfully."
  }
}
```
**Warning:** All private diaries are permanently lost. The old master key has been discarded.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `invalid_token` | 400 | Token missing, expired, or already used |
| `validation_error` | 422 | Invalid new password |
| `rate_limited` | 429 | Too many attempts |

---

## 3. Users & Profiles

### GET /api/v1/users/{username}

Get a user's public profile.

**Auth:** Optional (extra fields if viewing own profile)

**URL Parameters:**

| Parameter | Description |
|-----------|-------------|
| `username` | Username (case-sensitive) |

**Success (200):**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "moonwriter",
    "avatar_path": null,
    "about": "writing my thoughts, one diary at a time",
    "favorite_quote": "The unexamined life is not worth living.",
    "currently_feeling": "hopeful",
    "stats": {
      "diary_count": 24,
      "follower_count": 8,
      "following_count": 12
    },
    "created_at": "2025-12-01T14:30:00Z",
    "is_following": true
  }
}
```

**Fields:**

| Field | Visibility |
|-------|------------|
| `is_following` | Only if authenticated. Whether the requesting user follows this user. |

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `not_found` | 404 | Username does not exist |
| `account_banned` | 403 | User is banned |

---

### GET /api/v1/users/{username}/diaries

List a user's public diaries.

**Auth:** Optional
**Rate limit:** 60 per minute

**URL Parameters:**

| Parameter | Description |
|-----------|-------------|
| `username` | Username |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |
| `sort` | string | `created_at` | Sort field: `created_at`, `updated_at` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a2b3c4d5e6f7a8b9c0d1e",
      "title": "A Walk in the Rain",
      "excerpt": "Today I walked in the rain and felt alive...",
      "tags": ["life", "weather", "reflection"],
      "emotion": "hopeful",
      "stats": {
        "like_count": 12,
        "comment_count": 3,
        "bookmark_count": 5
      },
      "created_at": "2026-06-25T08:30:00Z",
      "updated_at": "2026-06-25T08:30:00Z",
      "published_at": "2026-06-25T08:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 24,
    "has_next": true,
    "has_prev": false
  }
}
```

**Note:** Only public diaries are returned. Private and draft diaries are excluded for all users (including the owner — the owner uses `/api/v1/me/diaries` which includes their own private/draft entries).

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `not_found` | 404 | Username does not exist |

---

### GET /api/v1/users/{username}/followers

List users who follow this user.

**Auth:** Optional
**Rate limit:** 60 per minute

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a1b2c3d4e5f6a7b8c9d0f",
      "username": "starreader",
      "avatar_path": null,
      "about": "I love reading diaries",
      "is_following": true
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 8, "has_next": false, "has_prev": false }
}
```

**Fields:**

| Field | Visibility |
|-------|------------|
| `is_following` | Only if authenticated. Whether the requesting user follows this user. |

---

### GET /api/v1/users/{username}/following

List users this user follows.

**Auth:** Optional

Response format identical to followers.

---

## 4. My Account

### PUT /api/v1/users/me

Update the current user's profile.

**Auth:** Bearer access token

**Request body:**
```json
{
  "avatar_path": null,
  "about": "Updated bio text",
  "favorite_quote": "New favorite quote",
  "currently_feeling": "grateful",
  "preferences": {
    "theme": "dark",
    "comments_disabled": false,
    "email_notifications": true,
    "notify_on_like": true,
    "notify_on_comment": true,
    "notify_on_follow": false,
    "notify_on_bookmark": false
  }
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `avatar_path` | Optional, nullable. Must reference an existing media entry owned by the user. |
| `about` | Optional. Max 500 chars. |
| `favorite_quote` | Optional. Max 300 chars. |
| `currently_feeling` | Optional. Max 50 chars. |
| `preferences.theme` | Must be `light`, `dark`, or `system`. |
| `preferences.comments_disabled` | Boolean. |
| `preferences.email_notifications` | Boolean. Only effective if user has email. |
| `preferences.notify_on_*` | Booleans. |

All fields are optional — only provided fields are updated.

**Success (200):**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "moonwriter",
    "about": "Updated bio text",
    "favorite_quote": "New favorite quote",
    "currently_feeling": "grateful",
    "updated_at": "2026-06-25T15:00:00Z"
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `validation_error` | 422 | Invalid field values |

---

### GET /api/v1/me/diaries

Get all of the current user's diaries (including private and drafts).

**Auth:** Bearer access token

**Query Parameters:** Same as user diaries (page, per_page, sort, order).

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a2b3c4d5e6f7a8b9c0d1e",
      "privacy": "public",
      "title": "A Walk in the Rain",
      "excerpt": "Today I walked in the rain...",
      "tags": ["life"],
      "emotion": "hopeful",
      "stats": { "like_count": 12, "comment_count": 3, "bookmark_count": 5 },
      "created_at": "2026-06-25T08:30:00Z",
      "updated_at": "2026-06-25T08:30:00Z",
      "published_at": "2026-06-25T08:30:00Z"
    },
    {
      "id": "665a3b4c5d6e7f8a9b0c1d2e",
      "privacy": "private",
      "title": null,
      "excerpt": null,
      "tags": [],
      "emotion": null,
      "stats": { "like_count": 0, "comment_count": 0, "bookmark_count": 0 },
      "encrypted_data": {
        "iv": "A1B2C3D4E5F6A7B8C9D0E1F2",
        "salt": "1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D",
        "ciphertext": "F3E4D5C6B7A8..."
      },
      "created_at": "2026-06-24T22:15:00Z",
      "updated_at": "2026-06-24T22:15:00Z",
      "published_at": null
    },
    {
      "id": "665a4b5c6d7e8f9a0b1c2d3e",
      "privacy": "draft",
      "title": "Unfinished Thoughts",
      "excerpt": "I've been thinking about...",
      "tags": ["draft"],
      "emotion": null,
      "stats": { "like_count": 0, "comment_count": 0, "bookmark_count": 0 },
      "created_at": "2026-06-23T19:00:00Z",
      "updated_at": "2026-06-23T19:45:00Z",
      "published_at": null
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 28, "has_next": true, "has_prev": false }
}
```

For private diaries: `title`, `excerpt`, `tags`, `emotion` are null. The client decrypts `encrypted_data` to display the title.

---

### GET /api/v1/me/likes

Get diaries the current user has liked.

**Auth:** Bearer access token

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a2b3c4d5e6f7a8b9c0d1e",
      "title": "A Walk in the Rain",
      "excerpt": "Today I walked in the rain...",
      "author": { "id": "665a1b2c...", "username": "moonwriter" },
      "tags": ["life"],
      "emotion": "hopeful",
      "stats": { "like_count": 12, "comment_count": 3, "bookmark_count": 5 },
      "liked_at": "2026-06-25T14:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 42, "has_next": true, "has_prev": false }
}
```

---

### GET /api/v1/me/bookmarks

Get diaries the current user has bookmarked.

Same structure as /me/likes.

---

### PUT /api/v1/users/me/email

Add or update the email on the current user's account.

**Auth:** Bearer access token

**Request body:**
```json
{
  "email": "user@example.com"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `email` | Valid email format. Max 254 chars. Pass `null` to remove email. |

**Success (200):**
```json
{
  "data": {
    "has_email": true,
    "email_verified": false,
    "message": "A verification email has been sent."
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `email_taken` | 409 | Email already associated with another account |
| `validation_error` | 422 | Invalid email format |

---

## 5. Diaries

### GET /api/v1/diaries

List public diaries. Supports browsing by latest, recently updated, tags, emotions, and date archive.

**Auth:** Optional
**Rate limit:** 60 per minute

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page (max 100) |
| `sort` | string | `latest` | Sort mode: `latest`, `updated`, `popular` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |
| `tags` | string | — | Comma-separated tag filter (OR logic) |
| `emotion` | string | — | Emotion filter (single value) |
| `year` | int | — | Year filter (e.g., 2026) |
| `month` | int | — | Month filter (1-12). Requires `year`. |

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a2b3c4d5e6f7a8b9c0d1e",
      "title": "A Walk in the Rain",
      "excerpt": "Today I walked in the rain and felt alive...",
      "author": {
        "id": "665a1b2c3d4e5f6a7b8c9d0e",
        "username": "moonwriter",
        "avatar_path": null
      },
      "tags": ["life", "weather", "reflection"],
      "emotion": "hopeful",
      "stats": {
        "like_count": 12,
        "comment_count": 3,
        "bookmark_count": 5
      },
      "is_liked": false,
      "is_bookmarked": false,
      "created_at": "2026-06-25T08:30:00Z",
      "updated_at": "2026-06-25T08:30:00Z",
      "published_at": "2026-06-25T08:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "has_next": true,
    "has_prev": false
  }
}
```

**Fields:**

| Field | Condition |
|-------|-----------|
| `is_liked` | Only if authenticated. Whether the requesting user liked this diary. |
| `is_bookmarked` | Only if authenticated. Whether the requesting user bookmarked this diary. |

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `validation_error` | 422 | Invalid parameter values (e.g., month without year) |

---

### GET /api/v1/diaries/random

Get a random public diary.

**Auth:** Optional
**Rate limit:** 30 per minute

**Success (200):**
```json
{
  "data": {
    "id": "665a2b3c4d5e6f7a8b9c0d1e",
    "title": "A Walk in the Rain",
    "content_html": "<p>Today I walked in the rain...</p>",
    "content_text": "Today I walked in the rain and felt alive.",
    "author": {
      "id": "665a1b2c3d4e5f6a7b8c9d0e",
      "username": "moonwriter",
      "avatar_path": null
    },
    "tags": ["life", "weather", "reflection"],
    "emotion": "hopeful",
    "comments_enabled": true,
    "comments_locked": false,
    "stats": { "like_count": 12, "comment_count": 3, "bookmark_count": 5 },
    "is_liked": false,
    "is_bookmarked": false,
    "created_at": "2026-06-25T08:30:00Z",
    "updated_at": "2026-06-25T08:30:00Z",
    "published_at": "2026-06-25T08:30:00Z"
  }
}
```

Returns the full diary content (same shape as GET /api/v1/diaries/{id}).

---

### POST /api/v1/diaries

Create a new diary entry.

**Auth:** Bearer access token
**Rate limit:** 30 per minute

**Request body (public/draft):**
```json
{
  "privacy": "public",
  "title": "A Walk in the Rain",
  "content_html": "<p>Today I walked in the rain and felt <em>alive</em>.</p>",
  "content_text": "Today I walked in the rain and felt alive.",
  "tags": ["life", "weather", "reflection"],
  "emotion": "hopeful",
  "comments_enabled": true
}
```

**Request body (private):**
```json
{
  "privacy": "private",
  "encrypted_data": {
    "iv": "A1B2C3D4E5F6A7B8C9D0E1F2",
    "salt": "1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D",
    "ciphertext": "F3E4D5C6B7A8..."
  },
  "comments_enabled": false
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `privacy` | Required. Must be `public`, `private`, or `draft`. |
| `title` | Required for public/draft. Max 200 chars. Null for private. |
| `content_html` | Required for public/draft. Max 100 KB. Null for private. |
| `content_text` | Required for public/draft. Max 50 KB. Null for private. |
| `tags` | Optional. Max 10 tags. Each tag: 1-30 chars, lowercase. Empty for private. |
| `emotion` | Optional. Must be a valid emotion value. Null for private. |
| `encrypted_data` | Required for private. Null for public/draft. |
| `comments_enabled` | Optional. Default true. Always false for private. |

**Success (201):**
```json
{
  "data": {
    "id": "665a2b3c4d5e6f7a8b9c0d1e",
    "created_at": "2026-06-25T08:30:00Z",
    "message": "Diary created successfully."
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `account_banned` | 403 | User account is banned |
| `validation_error` | 422 | Invalid field values |
| `rate_limited` | 429 | Too many requests |

---

### GET /api/v1/diaries/{id}

Get a single diary entry.

**Auth:** Optional (required for private diaries)

**URL Parameters:**

| Parameter | Description |
|-----------|-------------|
| `id` | Diary ID (24-char hex) |

**Success (200) — public diary:**
```json
{
  "data": {
    "id": "665a2b3c4d5e6f7a8b9c0d1e",
    "privacy": "public",
    "title": "A Walk in the Rain",
    "content_html": "<p>Today I walked in the rain and felt <em>alive</em>.</p>",
    "content_text": "Today I walked in the rain and felt alive.",
    "author": {
      "id": "665a1b2c3d4e5f6a7b8c9d0e",
      "username": "moonwriter",
      "avatar_path": null,
      "currently_feeling": "hopeful"
    },
    "tags": ["life", "weather", "reflection"],
    "emotion": "hopeful",
    "comments_enabled": true,
    "comments_locked": false,
    "stats": { "like_count": 12, "comment_count": 3, "bookmark_count": 5 },
    "is_liked": false,
    "is_bookmarked": false,
    "is_owner": false,
    "created_at": "2026-06-25T08:30:00Z",
    "updated_at": "2026-06-25T08:30:00Z",
    "published_at": "2026-06-25T08:30:00Z"
  }
}
```

**Success (200) — private diary:**
```json
{
  "data": {
    "id": "665a3b4c5d6e7f8a9b0c1d2e",
    "privacy": "private",
    "title": null,
    "content_html": null,
    "content_text": null,
    "author": {
      "id": "665a1b2c3d4e5f6a7b8c9d0e",
      "username": "moonwriter",
      "avatar_path": null
    },
    "tags": [],
    "emotion": null,
    "comments_enabled": false,
    "comments_locked": false,
    "stats": { "like_count": 0, "comment_count": 0, "bookmark_count": 0 },
    "encrypted_data": {
      "iv": "A1B2C3D4E5F6A7B8C9D0E1F2",
      "salt": "1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D",
      "ciphertext": "F3E4D5C6B7A8..."
    },
    "is_owner": true,
    "created_at": "2026-06-24T22:15:00Z",
    "updated_at": "2026-06-24T22:15:00Z",
    "published_at": null
  }
}
```

**Fields:**

| Field | Condition |
|-------|-----------|
| `is_liked` | Only if authenticated. |
| `is_bookmarked` | Only if authenticated. |
| `is_owner` | Only if authenticated. Whether the requesting user owns this diary. |

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `not_found` | 404 | Diary does not exist |
| `not_found` | 404 | Private/draft diary and user is not the owner (ambiguous 404 to prevent info leakage) |

---

### PUT /api/v1/diaries/{id}

Update a diary entry.

**Auth:** Bearer access token
**Authorization:** Must be the diary owner

**Request body:**
```json
{
  "privacy": "public",
  "title": "Updated Title",
  "content_html": "<p>Updated content.</p>",
  "content_text": "Updated content.",
  "tags": ["life", "updated"],
  "emotion": "reflective",
  "comments_enabled": true,
  "encrypted_data": null
}
```

All fields are optional — only provided fields are updated. Cannot change `privacy` from `private` to anything else (or vice versa) — deleting and recreating is safer.

**Validation:** Same as POST /api/v1/diaries, but all fields optional.

**Success (200):**
```json
{
  "data": {
    "id": "665a2b3c4d5e6f7a8b9c0d1e",
    "updated_at": "2026-06-25T16:00:00Z",
    "message": "Diary updated successfully."
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `forbidden` | 403 | Not the diary owner |
| `not_found` | 404 | Diary does not exist |
| `validation_error` | 422 | Invalid field values |

---

### DELETE /api/v1/diaries/{id}

Delete a diary entry and all associated data (comments, likes, bookmarks, media).

**Auth:** Bearer access token
**Authorization:** Must be the diary owner or admin

**Success (204):** No content.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `forbidden` | 403 | Not the diary owner and not admin |
| `not_found` | 404 | Diary does not exist |

---

## 6. Comments

### GET /api/v1/diaries/{id}/comments

List comments on a diary.

**Auth:** Optional (but diary must be public to see comments)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Max 100 |

**Success (200):**
```json
{
  "data": [
    {
      "id": "665b1c2d3e4f5a6b7c8d9e0f",
      "content": "This really resonates with me.",
      "author": {
        "id": "665a1b2c3d4e5f6a7b8c9d0f",
        "username": "starreader",
        "avatar_path": null
      },
      "is_deleted": false,
      "is_owner": false,
      "is_diary_owner": false,
      "parent_comment_id": null,
      "depth": 0,
      "reply_count": 3,
      "like_count": 5,
      "is_liked": false,
      "created_at": "2026-06-25T09:15:00Z",
      "updated_at": "2026-06-25T09:15:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 3, "has_next": false, "has_prev": false }
}
```

**Fields:**

| Field | Condition |
|-------|-----------|
| `is_owner` | Only if authenticated. Whether the requesting user wrote this comment. |
| `is_diary_owner` | Only if authenticated. Whether the requesting user owns the diary. |
| `is_liked` | Only if authenticated. Whether the current user has liked this comment. |
| `depth` | 0 for root comments, 1 for first-level replies, capped at 4. |
| `reply_count` | Number of direct replies to this comment. |
| `like_count` | Number of likes on this comment. |
| `parent_comment_id` | ID of the parent comment for replies; null for root comments. |

---

### POST /api/v1/diaries/{id}/comments

Add a comment to a diary.

**Auth:** Bearer access token

**Request body:**
```json
{
  "content": "This really resonates with me.",
  "parent_comment_id": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | 1-2000 characters. Plain text only. |
| `parent_comment_id` | string | No | ID of parent comment for threaded replies. |

**Validation:**

| Field | Rules |
|-------|-------|
| `content` | Required. 1-2000 chars. Plain text only. |
| `parent_comment_id` | If provided, must be a valid comment on the same diary. Max reply depth is 4. |

**Success (201):**
```json
{
  "data": {
    "id": "665b1c2d3e4f5a6b7c8d9e0f",
    "content": "This really resonates with me.",
    "author": { "id": "...", "username": "starreader", "avatar_path": null },
    "is_deleted": false,
    "is_owner": true,
    "parent_comment_id": null,
    "depth": 0,
    "reply_count": 0,
    "like_count": 0,
    "created_at": "2026-06-25T09:15:00Z"
  }
}
```

**Rate Limit:** 10 requests per minute per user.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `not_found` | 404 | Diary does not exist |
| `validation_error` | 422 | Invalid content, disabled/locked comments, max depth reached |
| `rate_limited` | 429 | Too many requests |

---

### DELETE /api/v1/diaries/{diary_id}/comments/{comment_id}

Soft-delete a comment.

**Auth:** Bearer access token
**Authorization:** Must be the comment author, the diary owner, or an admin

**Success (204):** No content.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `forbidden` | 403 | Not authorized to delete this comment |
| `not_found` | 404 | Comment does not exist or does not belong to this diary |

---

### GET /api/v1/comments/{comment_id}/replies

List replies to a comment (threaded).

**Auth:** Optional (diary must be public)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 10 | Max 50 |

**Success (200):**
```json
{
  "data": [ /* same shape as comment objects above */ ],
  "meta": { "page": 1, "per_page": 10, "total": 2, "has_next": false, "has_prev": false }
}
```

---

### POST /api/v1/comments/{comment_id}/like

Toggle like on a comment.

**Auth:** Bearer access token
**Rate Limit:** 30 requests per minute per user.

**Success (200):**
```json
{
  "data": {
    "is_liked": true,
    "like_count": 5
  }
}
```

---

## 7. Likes

### POST /api/v1/diaries/{id}/like

Toggle like on a diary.

**Auth:** Bearer access token
**Rate Limit:** 30 requests per minute per user.

**Success (200):**
```json
{
  "data": {
    "is_liked": true,
    "like_count": 5
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `not_found` | 404 | Diary does not exist or is not public |
| `forbidden` | 403 | Account is banned |
| `rate_limited` | 429 | Too many requests |

---

### GET /api/v1/me/likes

List diaries the current user has liked.

**Auth:** Bearer access token

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Max 100 |

**Success (200):** Returns standard paginated diary list enriched with `is_liked`, `is_bookmarked`, and `is_owner` flags.

---

## 8. Bookmarks

### POST /api/v1/diaries/{id}/bookmark

Toggle bookmark on a diary.

**Auth:** Bearer access token
**Rate Limit:** 30 requests per minute per user.

**Success (200):**
```json
{
  "data": {
    "is_bookmarked": true,
    "bookmark_count": 3
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `not_found` | 404 | Diary does not exist or is not public |
| `forbidden` | 403 | Account is banned |
| `rate_limited` | 429 | Too many requests |

---

### GET /api/v1/me/bookmarks

List diaries the current user has bookmarked.

**Auth:** Bearer access token

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Max 100 |

**Success (200):** Returns standard paginated diary list enriched with `is_liked`, `is_bookmarked`, and `is_owner` flags.

---

## 9. Follows

### POST /api/v1/users/{username}/follow

Toggle follow on a user.

**Auth:** Bearer access token
**Rate Limit:** 20 requests per minute per user.

**Success (200):**
```json
{
  "data": {
    "is_following": true,
    "follower_count": 42
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `not_found` | 404 | User does not exist |
| `validation_error` | 422 | Self-follow prevented |
| `forbidden` | 403 | Target user or requester is banned |
| `rate_limited` | 429 | Too many requests |

---

### GET /api/v1/users/{username}/followers

List followers of a user.

**Auth:** Optional. When authenticated, `is_following` is populated.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Max 100 |

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a1b...",
      "username": "reader42",
      "avatar_path": null,
      "about": "Just someone who loves journals",
      "is_following": false
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 42, "has_next": true, "has_prev": false }
}
```

---

### GET /api/v1/users/{username}/following

List users a user is following.

**Auth:** Optional. Same structure as followers.

---

### GET /api/v1/me/following/feed

Get recent public diaries from users the current user follows.

**Auth:** Bearer access token

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 6 | Max 20 |

**Success (200):** Returns standard diary list items enriched with `is_liked` and `is_bookmarked`.

---

## 10. Notifications

### GET /api/v1/notifications

List the current user's notifications.

**Auth:** Bearer access token

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |
| `unread_only` | bool | false | If true, only return unread notifications |

**Success (200):**
```json
{
  "data": [
    {
      "id": "665f1a2b3c4d5e6f7a8b9c0d",
      "type": "like",
      "actor": {
        "id": "665a1b2c3d4e5f6a7b8c9d0f",
        "username": "starreader",
        "avatar_path": null
      },
      "diary": {
        "id": "665a2b3c4d5e6f7a8b9c0d1e",
        "title": "A Walk in the Rain"
      },
      "read": false,
      "created_at": "2026-06-25T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 48,
    "unread_count": 3
  }
}
```

---

### GET /api/v1/notifications/unread-count

Get the count of unread notifications.

**Auth:** Bearer access token

**Success (200):**
```json
{
  "data": {
    "count": 3
  }
}
```

---

### PUT /api/v1/notifications/{id}/read

Mark a single notification as read.

**Auth:** Bearer access token
**Authorization:** Must own the notification

**Success (200):**
```json
{
  "data": {
    "message": "Notification marked as read."
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `forbidden` | 403 | Not the notification owner |
| `not_found` | 404 | Notification does not exist |

---

### PUT /api/v1/notifications/read-all

Mark all unread notifications as read.

**Auth:** Bearer access token

**Success (200):**
```json
{
  "data": {
    "message": "All notifications marked as read."
  }
}
```

---

## 11. Search

### GET /api/v1/search

Full-text search across public diaries using Meilisearch.

**Auth:** Optional
**Rate limit:** 30 per minute

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | — | Search query (required, min 1 char) |
| `tags` | string | — | Comma-separated tag filter (AND or OR — uses Meilisearch filter) |
| `emotion` | string | — | Emotion filter |
| `sort` | string | `relevance` | Sort: `relevance`, `created_at`, `updated_at` |
| `order` | string | `desc` | Sort order |
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a2b3c4d5e6f7a8b9c0d1e",
      "title": "A Walk in the Rain",
      "excerpt": "Today I walked in the <em>rain</em> and felt alive.",
      "author": {
        "id": "665a1b2c3d4e5f6a7b8c9d0e",
        "username": "moonwriter",
        "avatar_path": null
      },
      "tags": ["life", "weather", "reflection"],
      "emotion": "hopeful",
      "stats": { "like_count": 12, "comment_count": 3, "bookmark_count": 5 },
      "created_at": "2026-06-25T08:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 5,
    "query": "rain",
    "processing_time_ms": 12
  }
}
```

**Searchable fields:** title, content_text, tags, author_username.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `validation_error` | 422 | Missing `q` parameter |
| `rate_limited` | 429 | Too many requests |

---

## 12. Media

### POST /api/v1/media/upload

Upload a media file. Returns a URL for embedding in diary content.

**Auth:** Bearer access token
**Rate limit:** 10 per minute

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | The file to upload |
| `diary_id` | string | No | Associate with a specific diary (for cleanup) |
| `is_private` | bool | No | Whether the file is for a private diary |

**Accepted MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`, `video/mp4`, `video/webm`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/mp4`

**Max file sizes:**

| Type | Limit |
|------|-------|
| Images | 10 MB |
| Video | 50 MB |
| Audio | 30 MB |

**Success (201):**
```json
{
  "data": {
    "id": "666c1d2e3f4a5b6c7d8e9f0a",
    "url": "https://media.diaryarchive.com/users/665a1b2c/uuid-file.jpg",
    "thumbnail_url": "https://media.diaryarchive.com/users/665a1b2c/uuid-file_thumb.webp",
    "mime_type": "image/jpeg",
    "size_bytes": 2457600,
    "width": 1920,
    "height": 1080
  }
}
```

For private media, `url` and `thumbnail_url` are signed URLs with 15-minute expiry.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `file_too_large` | 413 | File exceeds size limit |
| `unsupported_media_type` | 415 | File type not allowed |
| `rate_limited` | 429 | Too many uploads |

---

### DELETE /api/v1/media/{id}

Delete a media file.

**Auth:** Bearer access token
**Authorization:** Must own the media file

**Success (204):** No content.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `forbidden` | 403 | Not the file owner |
| `not_found` | 404 | Media does not exist |

---

## 13. Reports

### POST /api/v1/reports

Submit a report against a diary, comment, or user.

**Auth:** Bearer access token
**Rate limit:** 10 per hour

**Request body:**
```json
{
  "target_type": "diary",
  "target_id": "665a2b3c4d5e6f7a8b9c0d1e",
  "reason": "harassment",
  "description": "This content contains targeted harassment."
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `target_type` | Required. Must be `diary`, `comment`, or `user`. |
| `target_id` | Required. Valid ObjectId. |
| `reason` | Required. Must be one of: `harassment`, `illegal_content`, `spam`, `impersonation`, `self_harm`, `other`. |
| `description` | Optional. Max 2000 chars. |

**Success (201):**
```json
{
  "data": {
    "id": "666a1b2c3d4e5f6a7b8c9d0e",
    "message": "Report submitted. Thank you for helping keep DiaryArchive safe."
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `cannot_report_self` | 400 | Cannot report yourself (when target_type=user) |
| `validation_error` | 422 | Invalid field values |
| `rate_limited` | 429 | Too many reports |

---

## 14. Tags & Emotions

### GET /api/v1/tags/popular

Get the most used tags across public diaries.

**Auth:** Optional
**Rate limit:** 30 per minute

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Number of tags to return (max 100) |

**Success (200):**
```json
{
  "data": [
    { "tag": "life", "count": 142 },
    { "tag": "reflection", "count": 98 },
    { "tag": "mental-health", "count": 87 }
  ]
}
```

---

### GET /api/v1/emotions

Get all available emotions with counts.

**Auth:** Optional

**Success (200):**
```json
{
  "data": [
    { "emotion": "happy", "count": 245 },
    { "emotion": "sad", "count": 189 },
    { "emotion": "anxious", "count": 134 },
    { "emotion": "hopeful", "count": 112 },
    { "emotion": "reflective", "count": 98 },
    { "emotion": "grateful", "count": 76 },
    { "emotion": "lonely", "count": 65 },
    { "emotion": "excited", "count": 54 },
    { "emotion": "angry", "count": 43 },
    { "emotion": "nostalgic", "count": 38 },
    { "emotion": "neutral", "count": 201 }
  ]
}
```

---

## 15. Admin

All admin endpoints require the requesting user to have `is_admin: true`.

### GET /api/v1/admin/reports

List reports for moderation.

**Auth:** Bearer access token (admin only)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `pending` | Filter by status: `pending`, `reviewed`, `dismissed`, `action_taken`, or `all` |
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |

**Success (200):**
```json
{
  "data": [
    {
      "id": "666a1b2c3d4e5f6a7b8c9d0e",
      "target_type": "diary",
      "target_id": "665a2b3c4d5e6f7a8b9c0d1e",
      "reason": "harassment",
      "description": "Targeted harassment.",
      "status": "pending",
      "reporter": {
        "id": "665a1b2c3d4e5f6a7b8c9d0f",
        "username": "starreader"
      },
      "created_at": "2026-06-25T14:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 5,
    "has_next": false,
    "has_prev": false
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `unauthorized` | 401 | Missing or invalid access token |
| `forbidden` | 403 | Not an admin |

---

### PUT /api/v1/admin/reports/{id}

Review or resolve a report.

**Auth:** Bearer access token (admin only)

**Request body:**
```json
{
  "status": "action_taken",
  "resolution": "Diary deleted, user warned. Content violated Terms of Service."
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `status` | Required. Must be `reviewed`, `dismissed`, or `action_taken`. |
| `resolution` | Optional. Max 1000 chars. |

**Success (200):**
```json
{
  "data": {
    "id": "666a1b2c3d4e5f6a7b8c9d0e",
    "status": "action_taken",
    "reviewed_by": "665a1b2c3d4e5f6a7b8c9d0a",
    "reviewed_at": "2026-06-25T16:00:00Z",
    "updated_at": "2026-06-25T16:00:00Z"
  }
}
```

---

### GET /api/v1/admin/users

List/search users.

**Auth:** Bearer access token (admin only)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | — | Search by username prefix |
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |

**Success (200):**
```json
{
  "data": [
    {
      "id": "665a1b2c3d4e5f6a7b8c9d0e",
      "username": "moonwriter",
      "has_email": true,
      "email_verified": true,
      "is_admin": false,
      "is_banned": false,
      "stats": { "diary_count": 24, "follower_count": 8, "following_count": 12 },
      "created_at": "2025-12-01T14:30:00Z",
      "last_login_at": "2026-06-25T10:15:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 42, "has_next": true, "has_prev": false }
}
```

---

### PUT /api/v1/admin/users/{id}/ban

Ban or unban a user.

**Auth:** Bearer access token (admin only)

**Request body:**
```json
{
  "is_banned": true,
  "ban_reason": "Repeated violation of Terms of Service - harassment"
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `is_banned` | Required. Boolean. |
| `ban_reason` | Required if `is_banned: true`. Max 500 chars. Optional if unbanning. |

**Success (200):**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "offendinguser",
    "is_banned": true,
    "banned_at": "2026-06-25T16:30:00Z"
  }
}
```

On ban: all of the user's refresh tokens are revoked, preventing further authenticated requests.

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `cannot_ban_admin` | 400 | Cannot ban another admin |
| `cannot_ban_self` | 400 | Cannot ban yourself |

---

### PUT /api/v1/admin/users/{id}/role

Change a user's admin role.

**Auth:** Bearer access token (admin only)

**Request body:**
```json
{
  "is_admin": true
}
```

**Validation:**

| Field | Rules |
|-------|-------|
| `is_admin` | Required. Boolean. |

**Success (200):**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "newadmin",
    "is_admin": true
  }
}
```

**Errors:**

| Code | Status | Condition |
|------|--------|-----------|
| `cannot_change_own_role` | 400 | Cannot change your own admin status |

---

### GET /api/v1/admin/audit-logs

View the audit trail of admin actions.

**Auth:** Bearer access token (admin only)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `actor_id` | string | — | Filter by admin user ID |
| `action` | string | — | Filter by action type |
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page (max 100) |

**Success (200):**
```json
{
  "data": [
    {
      "id": "666b1c2d3e4f5a6b7c8d9e0f",
      "actor": {
        "id": "665a1b2c3d4e5f6a7b8c9d0a",
        "username": "admin_user"
      },
      "action": "report.action_taken",
      "target_type": "report",
      "target_id": "666a1b2c3d4e5f6a7b8c9d0e",
      "details": {
        "resolution": "Diary deleted, user warned",
        "previous_status": "pending",
        "new_status": "action_taken"
      },
      "ip_address": "203.0.113.42",
      "created_at": "2026-06-25T16:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 156, "has_next": true, "has_prev": false }
}
```

---

### GET /api/v1/admin/stats

System-wide statistics for the admin dashboard.

**Auth:** Bearer access token (admin only)

**Success (200):**
```json
{
  "data": {
    "users": {
      "total": 10420,
      "banned": 15,
      "admins": 3,
      "joined_today": 12,
      "joined_this_week": 87
    },
    "diaries": {
      "total": 52400,
      "public": 48000,
      "private": 3200,
      "drafts": 1200,
      "created_today": 180,
      "created_this_week": 1250
    },
    "reports": {
      "pending": 5,
      "total_this_week": 23
    },
    "storage": {
      "media_total_bytes": 8589934592,
      "media_count": 12800,
      "database_size_bytes": 10737418240
    },
    "search": {
      "indexed_diaries": 47800,
      "last_sync": "2026-06-25T16:45:00Z"
    }
  }
}
```

---

### GET /api/v1/admin/health

Health check for all services.

**Auth:** Bearer access token (admin only)

**Success (200):**
```json
{
  "data": {
    "status": "healthy",
    "checks": {
      "mongodb": { "status": "healthy", "latency_ms": 3 },
      "redis": { "status": "healthy", "latency_ms": 1 },
      "meilisearch": { "status": "healthy", "latency_ms": 5 },
      "minio": { "status": "healthy", "latency_ms": 8 }
    },
    "uptime_seconds": 259200,
    "timestamp": "2026-06-25T17:00:00Z"
  }
}
```

---

## 16. Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | `incorrect_password` | Current password is wrong |
| 400 | `cannot_follow_self` | Cannot follow your own account |
| 400 | `cannot_report_self` | Cannot report your own content |
| 400 | `cannot_ban_admin` | Cannot ban another admin |
| 400 | `cannot_ban_self` | Cannot ban yourself |
| 400 | `cannot_change_own_role` | Cannot change your own admin status |
| 401 | `invalid_credentials` | Wrong username or password |
| 401 | `invalid_token` | Missing, expired, or revoked token |
| 401 | `unauthorized` | Authentication required |
| 403 | `account_banned` | User account is suspended |
| 403 | `forbidden` | Not permitted to perform this action |
| 403 | `comments_disabled` | Diary has comments disabled |
| 403 | `comments_locked` | Diary comments are locked |
| 403 | `diary_not_public` | Cannot interact with private diaries this way |
| 404 | `not_found` | Resource does not exist |
| 409 | `username_taken` | Username already registered |
| 409 | `email_taken` | Email already associated with an account |
| 409 | `already_liked` | Already liked this diary |
| 409 | `already_bookmarked` | Already bookmarked this diary |
| 409 | `already_following` | Already following this user |
| 413 | `file_too_large` | Upload exceeds maximum file size |
| 415 | `unsupported_media_type` | File type not accepted |
| 422 | `validation_error` | Request failed validation |
| 429 | `rate_limited` | Too many requests, slow down |

---

> **Next steps:**
> 1. Review this API design and provide feedback.
> 2. I can produce OpenAPI/Swagger YAML if desired.
> 3. Once approved, implementation starts with the auth endpoints and `/api/v1/auth/me`.
