# DiaryArchive Architecture

> Status: Draft — v0.1
> Authored: Architect-led, informed by diary-backend, diary-frontend, diary-database, diary-security, diary-encryption, diary-deployment, diary-search, diary-admin, diary-performance, diary-ui-system, diary-testing, diary-documentation skills.
> Last updated: 2026-06-25

---

## Table of Contents

1. [Overall System Architecture](#1-overall-system-architecture)
2. [Folder Structure](#2-folder-structure)
3. [Monorepo Layout](#3-monorepo-layout)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Database Schema](#6-database-schema)
7. [API Design](#7-api-design)
8. [Authentication Flow](#8-authentication-flow)
9. [Authorization Model](#9-authorization-model)
10. [End-to-End Encryption Design](#10-end-to-end-encryption-design)
11. [Public Diary Architecture](#11-public-diary-architecture)
12. [Private Diary Architecture](#12-private-diary-architecture)
13. [Search Architecture](#13-search-architecture)
14. [Media Storage Architecture](#14-media-storage-architecture)
15. [Notification Architecture](#15-notification-architecture)
16. [Admin Dashboard Architecture](#16-admin-dashboard-architecture)
17. [Deployment Architecture](#17-deployment-architecture)
18. [Scalability Strategy](#18-scalability-strategy)
19. [Security Model](#19-security-model)
20. [Privacy Model](#20-privacy-model)

---

## 1. Overall System Architecture

### Layered Design

```
┌─────────────────────────────────────────────────┐
│                   Cloudflare                      │  CDN, DDoS, SSL, DNS
├─────────────────────────────────────────────────┤
│                    Nginx                          │  Reverse proxy, rate limiting, static files
├─────────────────────────────────────────────────┤
│               Docker Compose                      │  Single-host orchestration
├────────────────────┬────────────────────────────┤
│                    │                              │
│     Next.js 15     │        FastAPI               │
│   (App Router)     │     (Python 3.13)           │
│   Port 3000        │     Port 8000               │
├────────────────────┴────────────────────────────┤
│                    Redis                          │  Cache, rate limiter, pub/sub
├─────────────────────────────────────────────────┤
│                  MongoDB                          │  Primary datastore
├─────────────────────────────────────────────────┤
│               Meilisearch                        │  Full-text search (public diaries only)
├─────────────────────────────────────────────────┤
│              MinIO / R2 / S3                     │  Object storage for media
└─────────────────────────────────────────────────┘
```

### Communication Flow

1. **Browser → Cloudflare**: All traffic passes through Cloudflare for CDN, DDoS protection, and SSL termination.
2. **Cloudflare → Nginx**: Nginx handles reverse proxying, rate limiting, and serving static assets.
3. **Nginx → Next.js**: `/` routes go to Next.js for SSR/SSG pages and API routes.
4. **Nginx → FastAPI**: `/api/v1/*` routes go to FastAPI.
5. **Nginx → MinIO**: `/media/*` routes directly to MinIO for public media, or proxied through FastAPI for authorized access.
6. **FastAPI → MongoDB**: All persistent data via Motor (async driver).
7. **FastAPI → Redis**: Caching, rate limiting, token blacklist, session data.
8. **FastAPI → Meilisearch**: Indexing and searching public diaries.
9. **FastAPI → MinIO**: Media upload and retrieval.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Directory-based | Simple; no monorepo tool overhead; Python + JS in one repo |
| API style | REST | Simpler than GraphQL for this domain; excellent OpenAPI support |
| Database | MongoDB | Document model fits diary entries; flexible schema for evolution |
| Async driver | Motor | Native async for FastAPI; prevents blocking |
| Search | Meilisearch | Purpose-built for typo-tolerant full-text; simpler than Elasticsearch |
| Object storage | MinIO → R2/S3 | MinIO for dev (S3-compatible); R2 for prod (no egress fees) |
| Real-time | Polling + Redis pub/sub | Polling for MVP; pub/sub for future WebSocket upgrade |
| Encryption | Client-side AES-256-GCM | True E2E; server never sees plaintext of private diaries |

---

## 2. Folder Structure

```
diaryarchive/
├── frontend/                    # Next.js application
│   ├── public/
│   │   ├── favicon.ico
│   │   └── images/
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   │   ├── (auth)/          # Login, Register (no layout chrome)
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (main)/          # Authenticated shell layout
│   │   │   │   ├── diary/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   └── new/
│   │   │   │   ├── explore/
│   │   │   │   ├── profile/
│   │   │   │   │   └── [username]/
│   │   │   │   ├── settings/
│   │   │   │   └── notifications/
│   │   │   ├── admin/           # Admin dashboard
│   │   │   ├── layout.tsx       # Root layout
│   │   │   └── page.tsx         # Homepage
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui primitives
│   │   │   ├── diary/           # Diary card, list, reader
│   │   │   ├── editor/          # Tiptap editor wrapper
│   │   │   ├── layout/          # Navbar, sidebar, footer
│   │   │   ├── shared/          # Avatar, Tag, EmotionBadge, etc.
│   │   │   └── admin/           # Admin-specific components
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-diaries.ts
│   │   │   ├── use-notifications.ts
│   │   │   └── use-crypto.ts    # Client-side encryption hooks
│   │   ├── lib/
│   │   │   ├── api/             # API client + TanStack Query hooks
│   │   │   ├── crypto/          # E2E encryption utilities
│   │   │   └── utils.ts
│   │   ├── store/               # Zustand stores
│   │   │   ├── auth-store.ts
│   │   │   ├── diary-store.ts
│   │   │   └── ui-store.ts
│   │   └── types/               # TypeScript type definitions
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.py
│   │   │   │   │   ├── diaries.py
│   │   │   │   │   ├── comments.py
│   │   │   │   │   ├── likes.py
│   │   │   │   │   ├── bookmarks.py
│   │   │   │   │   ├── follows.py
│   │   │   │   │   ├── notifications.py
│   │   │   │   │   ├── search.py
│   │   │   │   │   ├── media.py
│   │   │   │   │   ├── reports.py
│   │   │   │   │   └── admin.py
│   │   │   │   └── __init__.py
│   │   │   └── deps.py          # FastAPI dependencies
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings)
│   │   │   ├── security.py      # Password hashing, JWT, rate limiting
│   │   │   ├── database.py      # MongoDB + Redis connections
│   │   │   └── exceptions.py    # Custom exception handlers
│   │   ├── models/              # Pydantic request/response models
│   │   │   ├── auth.py
│   │   │   ├── diary.py
│   │   │   ├── user.py
│   │   │   ├── comment.py
│   │   │   ├── notification.py
│   │   │   └── ... 
│   │   ├── schemas/             # MongoDB document schemas (mappings)
│   │   │   ├── user.py
│   │   │   ├── diary.py
│   │   │   └── ...
│   │   ├── services/            # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── diary_service.py
│   │   │   ├── comment_service.py
│   │   │   ├── notification_service.py
│   │   │   ├── search_service.py
│   │   │   ├── media_service.py
│   │   │   └── admin_service.py
│   │   ├── repositories/        # Data access layer
│   │   │   ├── user_repo.py
│   │   │   ├── diary_repo.py
│   │   │   ├── comment_repo.py
│   │   │   └── ...
│   │   ├── tasks/               # Background tasks / periodic jobs
│   │   │   └── search_sync.py
│   │   └── main.py              # FastAPI app creation
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth/
│   │   ├── test_diaries/
│   │   └── ...
│   ├── alembic/                 # MongoDB migrations (optional)
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── Dockerfile
├── mobile/                      # React Native (future)
│   └── (placeholder)
├── docker/
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── templates/
│   └── scripts/
│       ├── init-mongo.js
│       └── init-meilisearch.js
├── docs/
│   ├── architecture.md          # This document
│   ├── database.md              # Detailed schema documentation
│   ├── api.md                   # API reference
│   ├── security.md              # Security model
│   ├── privacy.md               # Privacy model
│   ├── deployment.md            # Deployment guide
│   └── adr/                     # Architecture Decision Records
│       └── 001-e2e-encryption.md
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── deploy.yml
│   └── CODEOWNERS
├── docker-compose.yml           # Development
├── docker-compose.prod.yml      # Production overrides
├── .env.example
├── .gitignore
├── Makefile
└── README.md
```

---

## 3. Monorepo Layout

### Tooling Choices

| Tool | Purpose |
|------|---------|
| `pnpm` workspaces | Frontend package management |
| `uv` or `pip` | Backend dependency management |
| `Makefile` | Common commands (dev, test, lint, build) |
| `docker-compose` | Local development environment |

### Why Not Turborepo / Nx?

The project has only two independent codebases (frontend, backend) with no shared JavaScript between them. A full monorepo tool adds complexity without benefit. Directory-based organization with per-project build tools is the simplest approach.

### Dependency Management

- **Frontend**: `pnpm` with `package.json` in `frontend/`. Lockfile at `frontend/pnpm-lock.yaml`.
- **Backend**: `requirements.txt` + `pyproject.toml` in `backend/`. Use `uv` for fast installs in CI.
- **Docker**: Both services have their own `Dockerfile`.

### Shared Configuration

- `.gitignore` at root with patterns for both Python and Node.js artifacts.
- `.env.example` at root documents all environment variables.
- `Makefile` at root with convenience targets:
  - `make dev` — starts all services via docker-compose
  - `make test` — runs both frontend and backend tests
  - `make lint` — runs ruff + eslint + prettier
  - `make build` — builds production Docker images

---

## 4. Frontend Architecture

### Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15 | React framework with App Router |
| React | 19 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | Latest | Accessible component primitives |
| TanStack Query | 5.x | Server state management |
| Zustand | 5.x | Client state management |
| Tiptap | Latest | Rich text editor |
| Lucide React | Latest | Icons |

### Page Architecture

```
Root Layout (html, body, providers)
├── Auth Layout (login, register) — minimal chrome
│   ├── /login
│   └── /register
├── Main Layout (navbar, sidebar, main content)
│   ├── / (homepage)
│   ├── /explore
│   ├── /diary/[id] (reader)
│   ├── /diary/new (editor)
│   ├── /diary/[id]/edit (editor)
│   ├── /profile/[username]
│   ├── /settings
│   └── /notifications
└── Admin Layout (admin sidebar, header)
    ├── /admin
    ├── /admin/reports
    ├── /admin/users
    ├── /admin/audit-logs
    └── /admin/health
```

### Client State Strategy

| State Type | Tool | Rationale |
|------------|------|-----------|
| Server state | TanStack Query | Caching, refetching, optimistic updates |
| Auth state | Zustand + httpOnly cookies | JWT in memory, refresh in cookie |
| UI state | Zustand | Theme, sidebar open, editor state |
| Form state | React Hook Form + Zod | Validation, error handling |

### Performance Decisions

- **SSR for public diary pages**: Fast initial load, good SEO for public content.
- **CSR for dashboard/settings**: Authenticated pages benefit from client-side navigation.
- **Static generation for homepage**: If content changes infrequently, revalidate periodically.
- **Image optimization**: Next.js `<Image>` component with remote patterns for MinIO.
- **Bundle splitting**: Dynamic imports for the Tiptap editor (large dependency).
- **Font loading**: Self-hosted fonts (Inter for UI, JetBrains Mono for code) via `next/font`.

### Accessibility Targets

- WCAG AA compliance minimum.
- Keyboard navigation for all interactive elements.
- Screen reader support via ARIA labels and semantic HTML.
- Focus management in modals, dialogs, and the editor.
- Color contrast ratios meeting AA standards in both themes.
- Reduced motion media query support.

### Theming

- Dark and light modes via Tailwind `darkMode: 'class'`.
- Theme persisted in localStorage, synced with system preference on first visit.
- CSS custom properties for typography, spacing, and color tokens.
- shadcn/ui CSS variables for component theming.

---

## 5. Backend Architecture

### Stack

| Layer | Technology |
|-------|------------|
| Framework | FastAPI |
| Language | Python 3.13 |
| Async DB driver | Motor (MongoDB) |
| Async Redis | redis-py (asyncio) |
| Search client | meilisearch-python-async |
| Validation | Pydantic v2 |
| Auth | python-jose (JWT), passlib (Argon2id) |
| File uploads | python-multipart |
| Background tasks | FastAPI BackgroundTasks + APScheduler |

### Layered Architecture

```
HTTP Request
    │
    ▼
Middleware (CORS, CSP headers, rate limiting, request ID)
    │
    ▼
API Router (v1/ endpoints — validation, routing)
    │
    ▼
Dependencies (auth check, permission check, DB session)
    │
    ▼
Service Layer (business logic, orchestration)
    │
    ▼
Repository Layer (data access, query building)
    │
    ▼
Database / Cache / Search
```

### Service Layer Guidelines

- Services contain all business logic. Endpoints are thin — they validate input, call services, return responses.
- Services depend on repositories and external clients, not directly on FastAPI request objects.
- Services raise typed exceptions that exception handlers convert to HTTP responses.
- Services are stateless — all state is in the database or cache.

### Repository Layer Guidelines

- Repositories abstract MongoDB collection access.
- Repositories return domain models, not raw dictionaries.
- Complex aggregation pipelines are encapsulated in repository methods.
- Index management is documented alongside repository code.

### Error Handling

- Custom exception classes for each error category:
  - `NotFoundException`
  - `PermissionDeniedException`
  - `ValidationException`
  - `RateLimitException`
  - `AuthenticationException`
- FastAPI exception handlers convert these to consistent JSON responses.
- All errors return `{ "error": { "code": "...", "message": "..." } }`.

### Background Tasks

- FastAPI `BackgroundTasks` for fire-and-forget operations (notification creation, search indexing).
- Periodic tasks via APScheduler for:
  - Full Meilisearch re-sync (daily)
  - Expired token cleanup
  - Temporary file cleanup

---

## 6. Database Schema

### Collections Overview

| Collection | Purpose | Growth |
|------------|---------|--------|
| `users` | User accounts and profiles | ~10k docs |
| `diaries` | Diary entries (public + private) | ~1M docs |
| `comments` | Comments on public diaries | ~5M docs |
| `likes` | Likes on public diaries | ~10M docs |
| `bookmarks` | Bookmarks on public diaries | ~2M docs |
| `follows` | Follow relationships | ~100k docs |
| `notifications` | User notifications | ~10M docs |
| `reports` | Content reports | ~10k docs |
| `audit_logs` | Administrative actions | ~100k docs |
| `media` | Media file metadata | ~100k docs |
| `refresh_tokens` | Refresh token hashes | ~20k docs |

### Schema Design Principles

- **Reference relationships** via `ObjectId` (don't embed unbounded arrays).
- **Denormalize stats** (like count, comment count) on the diary document to avoid counting queries.
- **Use sparse indexes** for optional fields like email.
- **Pre-allocate** `_id` as `ObjectId` for all documents (includes timestamp for sorting).

### users

```javascript
{
  _id: ObjectId,
  username: String,              // unique, lowercase, 3-20 chars, alphanumeric + underscore
  password_hash: String,         // Argon2id hash
  email_encrypted: String|null,  // AES-256-GCM encrypted
  email_hash: String|null,       // SHA-256 for uniqueness check (sparse unique index)
  email_verified: Boolean,
  avatar_path: String|null,      // Path in MinIO
  about: String|null,            // Max 500 chars
  favorite_quote: String|null,
  currently_feeling: String|null,
  preferences: {
    theme: String,               // "light" | "dark" | "system"
    comments_disabled: Boolean,
    email_notifications: Boolean
  },
  stats: {
    diary_count: Number,
    follower_count: Number,
    following_count: Number
  },
  encrypted_master_key: String|null,  // E2E: master key encrypted with password-derived key
  master_key_salt: String|null,        // Salt for password-derived key derivation
  is_admin: Boolean,
  is_banned: Boolean,
  banned_at: Date|null,
  created_at: Date,
  updated_at: Date,
  last_login_at: Date
}
```

**Indexes:**
- `{ username: 1 }` — unique
- `{ email_hash: 1 }` — sparse unique (only for users with email)
- `{ created_at: -1 }` — for user listing

### diaries

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,             // Reference to users
  privacy: String,               // "public" | "private" | "draft"
  
  // Public content (visible when privacy = "public")
  title: String|null,
  content_html: String|null,     // HTML from Tiptap
  content_text: String|null,     // Plain text extracted for search
  tags: [String],                // Lowercase, max 10 tags
  emotion: String|null,          // "happy" | "sad" | "anxious" | etc.
  
  // Private encrypted content (when privacy = "private")
  encrypted_title: String|null,  // AES-256-GCM encrypted title
  encrypted_content: String|null,// AES-256-GCM encrypted content
  encrypted_tags: String|null,   // AES-256-GCM encrypted tags (JSON array)
  encryption_iv: String|null,    // Initialization vector
  encryption_salt: String|null,  // Salt for key derivation
  
  // Settings
  comments_enabled: Boolean,
  comments_locked: Boolean,
  
  // Metadata
  year: Number,                  // Denormalized for browsing
  month: Number,                 // Denormalized for browsing
  
  // Stats (denormalized)
  stats: {
    like_count: Number,
    comment_count: Number,
    bookmark_count: Number
  },
  
  // Timestamps
  created_at: Date,
  updated_at: Date,
  published_at: Date|null
}
```

**Indexes:**
- `{ user_id: 1, created_at: -1 }` — user's diary list
- `{ privacy: 1, created_at: -1 }` — public feed
- `{ privacy: 1, updated_at: -1 }` — recently updated
- `{ privacy: 1, tags: 1, created_at: -1 }` — tag browsing
- `{ privacy: 1, year: -1, month: -1 }` — archive browsing
- `{ privacy: 1, emotion: 1, created_at: -1 }` — emotion browsing
- `{ privacy: 1, stats.like_count: -1 }` — popular diaries
- `{ user_id: 1, privacy: 1, created_at: -1 }` — user's public/private lists

### comments

```javascript
{
  _id: ObjectId,
  diary_id: ObjectId,
  user_id: ObjectId,
  content: String,               // Max 2000 chars, plain text or minimal HTML
  is_deleted: Boolean,
  created_at: Date,
  updated_at: Date
}
```

**Indexes:**
- `{ diary_id: 1, created_at: 1 }` — comments for a diary
- `{ user_id: 1, created_at: -1 }` — user's comment history

### likes

```javascript
{
  _id: ObjectId,
  diary_id: ObjectId,
  user_id: ObjectId,
  created_at: Date
}
```

**Indexes:**
- `{ diary_id: 1, user_id: 1 }` — unique compound (prevent duplicate likes)
- `{ diary_id: 1 }` — count likes for a diary
- `{ user_id: 1 }` — user's liked diaries

### bookmarks

Same structure as `likes` (replace `likes` semantics with `bookmarks`).

### follows

```javascript
{
  _id: ObjectId,
  follower_id: ObjectId,
  following_id: ObjectId,
  created_at: Date
}
```

**Indexes:**
- `{ follower_id: 1, following_id: 1 }` — unique compound
- `{ follower_id: 1 }` — who I follow
- `{ following_id: 1 }` — who follows me

### notifications

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,             // Notification recipient
  type: String,                  // "like" | "comment" | "follow" | "bookmark"
  actor_id: ObjectId,            // Who performed the action
  diary_id: ObjectId|null,       // Related diary (if applicable)
  comment_id: ObjectId|null,     // Related comment (if applicable)
  read: Boolean,
  created_at: Date
}
```

**Indexes:**
- `{ user_id: 1, read: 1, created_at: -1 }` — unread notifications first
- `{ user_id: 1, created_at: -1 }` — all notifications

### reports

```javascript
{
  _id: ObjectId,
  reporter_id: ObjectId,
  target_type: String,           // "diary" | "comment" | "user"
  target_id: ObjectId,
  reason: String,                // "harassment" | "illegal" | "spam" | "other"
  description: String|null,      // Optional additional context
  status: String,                // "pending" | "reviewed" | "dismissed" | "action_taken"
  reviewed_by: ObjectId|null,
  reviewed_at: Date|null,
  resolution: String|null,       // Admin notes
  created_at: Date
}
```

**Indexes:**
- `{ status: 1, created_at: -1 }` — report queue
- `{ reporter_id: 1 }` — user's reports

### audit_logs

```javascript
{
  _id: ObjectId,
  actor_id: ObjectId,
  action: String,                // "user.banned" | "diary.deleted" | "report.resolved"
  target_type: String,
  target_id: ObjectId|null,
  details: Object,               // Arbitrary JSON for context
  ip_address: String,
  created_at: Date
}
```

**Indexes:**
- `{ created_at: -1 }` — chronological listing
- `{ actor_id: 1, created_at: -1 }` — admin action history
- `{ target_type: 1, target_id: 1 }` — actions on a specific entity

### media

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  diary_id: ObjectId|null,       // Which diary this media belongs to
  filename: String,              // Original filename
  stored_path: String,           // Path in MinIO/S3 bucket
  mime_type: String,
  size_bytes: Number,
  width: Number|null,            // For images
  height: Number|null,
  is_private: Boolean,           // If associated with a private diary
  created_at: Date
}
```

**Indexes:**
- `{ user_id: 1 }` — user's uploads
- `{ diary_id: 1 }` — diary's media
- `{ created_at: -1 }` — chronological

### refresh_tokens

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  token_hash: String,            // SHA-256 of refresh token
  expires_at: Date,
  created_at: Date
}
```

**Indexes:**
- `{ token_hash: 1 }` — unique
- `{ expires_at: 1 }` — TTL index for automatic cleanup
- `{ user_id: 1 }` — revoke all tokens for a user

---

## 7. API Design

### Base URL

- Development: `http://localhost:8000/api/v1`
- Production: `https://diaryarchive.com/api/v1`

### Authentication

All endpoints except auth/registration require either:
- `Authorization: Bearer <access_token>` header, or
- `refresh_token` httpOnly cookie (for refresh endpoint only)

### Standard Responses

**Success:**
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "not_found",
    "message": "Diary not found"
  }
}
```

### Endpoints

#### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Sign in |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/change-password` | Change password (re-encrypts master key) |
| POST | `/auth/request-reset` | Request password reset (requires email) |
| POST | `/auth/reset-password` | Reset password with token |

**Register:**
```
POST /auth/register
Request: {
  "username": "string (3-20 chars, alphanumeric + underscore)",
  "password": "string (8+ chars)",
  "email": "string | null"
}
Response: {
  "data": {
    "user": { "id", "username", "created_at" },
    "access_token": "string",
    "expires_in": 900
  }
}
// Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
```

**Login:**
```
POST /auth/login
Request: {
  "username": "string",
  "password": "string"
}
Response: {
  "data": {
    "user": { "id", "username" },
    "access_token": "string",
    "expires_in": 900
  }
}
```

#### Diaries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/diaries` | List public diaries (paginated, sorted) |
| GET | `/diaries/random` | Get a random public diary |
| GET | `/diaries/featured` | Diaries by year/month/tag/emotion |
| GET | `/diaries/{id}` | Get a diary |
| POST | `/diaries` | Create a diary |
| PUT | `/diaries/{id}` | Update a diary |
| DELETE | `/diaries/{id}` | Delete a diary |

**List public diaries:**
```
GET /diaries?page=1&per_page=20&sort=latest
              &tags=life,travel
              &emotion=happy
              &year=2026
              &month=6
Response: {
  "data": [
    {
      "id": "ObjectId",
      "user": { "id", "username", "avatar_path" },
      "title": "string",
      "excerpt": "string (first 200 chars of content_text)",
      "tags": ["string"],
      "emotion": "string|null",
      "stats": { "like_count", "comment_count", "bookmark_count" },
      "created_at": "Date",
      "updated_at": "Date",
      "published_at": "Date|null"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 142 }
}
```

**Get diary:**
```
GET /diaries/{id}
Response: {
  "data": {
    "id": "ObjectId",
    "user": { "id", "username", "avatar_path" },
    "privacy": "public",
    "title": "string",
    "content_html": "string",
    "tags": ["string"],
    "emotion": "string|null",
    "comments_enabled": true,
    "comments_locked": false,
    "stats": { "like_count", "comment_count", "bookmark_count" },
    "is_liked": false,      // If authenticated viewer liked it
    "is_bookmarked": false,  // If authenticated viewer bookmarked it
    "created_at": "Date",
    "updated_at": "Date",
    "published_at": "Date|null"
  }
}
```

For private diaries, `content_html` is `null` and instead:
```json
{
  "encrypted_title": "base64...",
  "encrypted_content": "base64...",
  "encrypted_tags": "base64...",
  "encryption_iv": "base64...",
  "encryption_salt": "base64..."
}
```

**Create diary:**
```
POST /diaries
Request: {
  "privacy": "public | private | draft",
  "title": "string | null",
  "content_html": "string | null",       // For public
  "content_text": "string | null",       // For search indexing
  "tags": ["string"],
  "emotion": "string | null",
  "comments_enabled": true,
  // For private:
  "encrypted_title": "string | null",
  "encrypted_content": "string | null",
  "encrypted_tags": "string | null",
  "encryption_iv": "string | null",
  "encryption_salt": "string | null"
}
Response: 201 { "data": { "id": "..." } }
```

#### Comments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/diaries/{id}/comments` | List comments |
| POST | `/diaries/{id}/comments` | Create comment |
| DELETE | `/comments/{id}` | Delete comment (owner or diary owner) |

#### Likes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/diaries/{id}/likes` | List users who liked |
| POST | `/diaries/{id}/likes` | Like a diary |
| DELETE | `/diaries/{id}/likes` | Unlike |

#### Bookmarks

Same pattern as Likes.

#### Follows

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/{username}/followers` | List followers |
| GET | `/users/{username}/following` | List following |
| POST | `/users/{username}/follow` | Follow user |
| DELETE | `/users/{username}/follow` | Unfollow |

#### User Profiles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/{username}` | Get user profile |
| PUT | `/users/me` | Update own profile |
| GET | `/users/{username}/diaries` | List user's public diaries |

#### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Search public diaries |

```
GET /search?q=query&tags=tag1,tag2&emotion=happy&sort=relevance&page=1
Response: {
  "data": [
    {
      "id": "ObjectId",
      "title": "string",
      "excerpt": "string (highlighted)",
      "author": { "id", "username" },
      "tags": ["string"],
      "emotion": "string|null",
      "created_at": "Date"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "query": "original query",
    "processing_time_ms": 12
  }
}
```

#### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List user's notifications |
| PUT | `/notifications/{id}/read` | Mark as read |
| PUT | `/notifications/read-all` | Mark all as read |

#### Reports

| Method | Path | Description |
|--------|------|-------------|
| POST | `/reports` | Submit a report |

```
POST /reports
Request: {
  "target_type": "diary | comment | user",
  "target_id": "ObjectId",
  "reason": "string",
  "description": "string | null"
}
Response: 201 { "data": { "id": "..." } }
```

#### Media

| Method | Path | Description |
|--------|------|-------------|
| POST | `/media/upload` | Upload a file |
| DELETE | `/media/{id}` | Delete a file |

```
POST /media/upload
Request: multipart/form-data { file: binary, diary_id?: ObjectId }
Response: {
  "data": {
    "id": "ObjectId",
    "url": "string (signed or direct URL)",
    "mime_type": "string"
  }
}
```

#### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/reports` | List reports (paginated, filterable) |
| PUT | `/admin/reports/{id}` | Review/resolve a report |
| GET | `/admin/users` | List/search users |
| PUT | `/admin/users/{id}/ban` | Ban/unban user |
| PUT | `/admin/users/{id}/role` | Change user role |
| GET | `/admin/audit-logs` | View audit logs |
| GET | `/admin/stats` | System statistics |
| GET | `/admin/health` | Service health check |

---

## 8. Authentication Flow

### Registration

```
Client                              Server
  │                                    │
  ├─ POST /auth/register ──────────────►
  │   { username, password, email? }   │
  │                                    ├─ Validate input
  │                                    ├─ Check username uniqueness
  │                                    ├─ Hash password (Argon2id)
  │                                    ├─ Encrypt email if provided (AES-256-GCM)
  │                                    ├─ Create user document
  │                                    ├─ Generate access_token (JWT, 15min)
  │                                    ├─ Generate refresh_token (random, 7 days)
  │                                    ├─ Store refresh_token hash
  │                                    └─ Respond ───────────────────►
  │◄───────────────────────────────────── 201 { user, access_token }
  │                                    Set-Cookie: refresh_token (httpOnly)
```

### Login

```
Client                              Server
  │                                    │
  ├─ POST /auth/login ─────────────────►
  │   { username, password }           │
  │                                    ├─ Find user by username
  │                                    ├─ Verify password (Argon2id)
  │                                    ├─ Generate tokens
  │                                    ├─ Update last_login_at
  │                                    └─ Respond ───────────────────►
  │◄───────────────────────────────────── { user, access_token }
  │                                    Set-Cookie: refresh_token (httpOnly)
```

### Token Refresh

```
Client                              Server
  │                                    │
  ├─ POST /auth/refresh ───────────────►
  │   Cookie: refresh_token=xxx        │
  │                                    ├─ Hash cookie value
  │                                    ├─ Find hash in refresh_tokens collection
  │                                    ├─ Check expiration
  │                                    ├─ Rotate token (optional: revoke old, issue new)
  │                                    ├─ Generate new access_token
  │                                    └─ Respond ───────────────────►
  │◄───────────────────────────────────── { access_token }
  │                                    Set-Cookie: refresh_token (new)
```

### Logout

```
Client                              Server
  │                                    │
  ├─ POST /auth/logout ────────────────►
  │   Cookie: refresh_token=xxx        │
  │                                    ├─ Delete refresh_token from DB
  │                                    └─ Respond 204 ───────────────►
  │◄───────────────────────────────────── Clear-Cookie: refresh_token
```

### Token Design

**Access Token (JWT):**
```json
{
  "sub": "user_id",
  "username": "user",
  "is_admin": false,
  "exp": 1719300000,   // 15 minutes from now
  "iat": 1719299100,
  "jti": "unique-token-id"
}
```

**Refresh Token:**
- Random 256-bit value (not a JWT).
- Stored as SHA-256 hash in the `refresh_tokens` collection.
- Allows server-side revocation.
- 7-day expiration.

### Why JWT Access + Random Refresh Tokens?

| Approach | Pros | Cons |
|----------|------|------|
| JWT only | Stateless, simple | Cannot revoke individual tokens |
| JWT access + JWT refresh | Both stateless | Refresh tokens can't be revoked individually |
| JWT access + DB-stored refresh | Revocable, secure refresh | Requires DB lookup per refresh |

We choose **JWT access + DB-stored refresh tokens** because:
1. Access tokens are short-lived (15 min), limiting damage if leaked.
2. Refresh tokens can be individually revoked (logout, password change, admin action).
3. The DB lookup per refresh is negligible at our scale.
4. We can implement refresh token rotation for extra security.

---

## 9. Authorization Model

### Roles

| Role | Description |
|------|-------------|
| `user` | Standard authenticated user |
| `admin` | Administrator with moderation tools |

### Permissions Matrix

| Action | Owner | Any User (Auth) | Any User (Guest) | Admin |
|--------|-------|-----------------|-------------------|-------|
| Read public diary | ✓ | ✓ | ✓ | ✓ |
| Read private diary | ✓ | ✗ | ✗ | ✗ |
| Create diary | ✓ | ✓ | ✗ | ✓ |
| Edit own diary | ✓ | ✗ | ✗ | ✗ |
| Delete own diary | ✓ | ✗ | ✗ | ✗ |
| Comment on diary | ✓* | ✓** | ✗ | ✓ |
| Delete comment (own) | ✓ | ✓ | ✗ | ✓ |
| Delete comment (on own diary) | ✓ | ✗ | ✗ | ✓ |
| Like / Unlike | ✓ | ✓ | ✗ | ✓ |
| Bookmark / Unbookmark | ✓ | ✓ | ✗ | ✓ |
| Follow / Unfollow | ✓ | ✓ | ✗ | ✓ |
| View reports | ✗ | ✗ | ✗ | ✓ |
| Moderate content | ✗ | ✗ | ✗ | ✓ |
| Ban users | ✗ | ✗ | ✗ | ✓ |
| View audit logs | ✗ | ✗ | ✗ | ✓ |
| View system health | ✗ | ✗ | ✗ | ✓ |

\* *Owner can always comment on own diary unless comments are disabled.*
\** *Only if the diary has comments enabled and not locked.*

### Ban Enforcement

- Banned users cannot authenticate (login rejects).
- Existing sessions are invalidated on ban (refresh tokens revoked).
- Banned user's public content remains visible but is flagged as "by a suspended user."
- Banned users cannot create new content.

### Permission Checks

Implemented as FastAPI dependencies:

```python
# Example: Only the diary owner can edit
async def verify_diary_ownership(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    diary_repo: DiaryRepository = Depends(get_diary_repo),
):
    diary = await diary_repo.get_by_id(diary_id)
    if not diary:
        raise NotFoundException("Diary not found")
    if diary.user_id != current_user.id:
        raise PermissionDeniedException("You do not own this diary")
    return diary
```

---

## 10. End-to-End Encryption Design

### Philosophy

True end-to-end encryption means:
- Encrypted in the browser before upload.
- Server never has access to plaintext.
- Server cannot decrypt even if compromised.
- Encryption keys never leave the user's devices.

### Key Hierarchy

```
Password
    │
    ▼
Argon2id(password, salt) ──────► Password-Derived Key (PDK)
    │
    ▼
AES-256-GCM-Decrypt(encrypted_master_key, PDK)
    │
    ▼
Master Key (256-bit random, stored encrypted on server)
    │
    ├── HKDF(master_key, diary_salt_1) ──► Diary Key 1
    ├── HKDF(master_key, diary_salt_2) ──► Diary Key 2
    └── ...
```

### Key Lifecycle

#### Registration

1. Client generates a random 256-bit **Master Key**.
2. Client generates a random **salt**.
3. Client derives a **Password-Derived Key** (PDK) using Argon2id(password, salt).
4. Client encrypts the Master Key with PDK using AES-256-GCM.
5. Client sends the encrypted Master Key + salt to the server.
6. Server stores `encrypted_master_key` and `master_key_salt` on the user document.

#### Login

1. Client fetches `encrypted_master_key` + `master_key_salt` from server (this can happen on login or on first diary access).
2. Client derives PDK using Argon2id(password, salt).
3. Client decrypts Master Key using PDK.
4. Master Key is held in memory (never persisted to localStorage).

#### Writing a Private Diary

1. Client generates a random **diary salt** (256-bit).
2. Client derives a **Diary Key** using HKDF(Master Key, diary_salt).
3. Client generates a random **IV** (96-bit for GCM).
4. Client encrypts `{ title, content_html, tags }` as JSON using AES-256-GCM with Diary Key + IV.
5. Client sends ciphertext + IV + salt to server.
6. Server stores `encrypted_title`, `encrypted_content`, `encrypted_tags`, `encryption_iv`, `encryption_salt`.

#### Reading a Private Diary

1. Client fetches the diary document.
2. Client derives Diary Key using HKDF(Master Key, diary_salt).
3. Client decrypts ciphertext using AES-256-GCM with Diary Key + IV.
4. Client parses JSON to get `{ title, content, tags }`.

#### Password Change

1. Client has Master Key in memory (required to change password).
2. Client derives new PDK using Argon2id(new_password, new_salt).
3. Client re-encrypts Master Key with new PDK.
4. Client sends new encrypted Master Key + new salt.
5. Server updates `encrypted_master_key` and `master_key_salt`.

#### Account Recovery (With Email)

If the user has an email:
1. User requests password reset.
2. Server sends reset link to email.
3. Reset flow creates a **new** Master Key (old data is unrecoverable).
4. User loses access to all existing private diaries.

This is an intentional tradeoff: **password reset = loss of private diaries**. The alternative (storing a recovery key server-side) would break E2E encryption.

### Cryptographic Standards

| Component | Algorithm | Rationale |
|-----------|-----------|-----------|
| Password hashing | Argon2id | Memory-hard, resistant to GPU/ASIC attacks |
| Master Key encryption | AES-256-GCM | Authenticated encryption, widely supported |
| Key derivation | HKDF-SHA256 | NIST standard key derivation |
| Diary encryption | AES-256-GCM | Same standard, per-document keys |
| Random generation | Web Crypto API `crypto.getRandomValues()` | Cryptographically secure in browsers |

### Key Derivation Parameters

**Argon2id (for PDK):**
- Memory: 64 MB
- Iterations: 3
- Parallelism: 4
- Output: 32 bytes (256 bits)

**HKDF (for diary keys):**
- Hash: SHA-256
- Salt: diary_salt (32 bytes random)
- Info: "diaryarchive-diary-key-v1"
- Output: 32 bytes

### Tradeoffs and Notes

1. **Password change without old password is impossible** — if someone forgets their password AND has no email, their private diaries are permanently lost. This is the stated design.

2. **Password reset with email destroys private diaries** — the alternative would be storing a recovery key server-side, which breaks the E2E promise. We explicitly choose honesty over convenience.

3. **Per-diary keys vs. single key** — HKDF-derived per-diary keys limit the blast radius: if one diary key is somehow compromised, only that diary is exposed.

4. **No key on server** — the encrypted master key is stored on the server, but it is useless without the password. A server breach does not expose private diary contents.

5. **Web Crypto API** — all cryptographic operations happen in the browser using the Web Crypto API. No custom crypto implementations. No crypto libraries with potential supply chain issues.

---

## 11. Public Diary Architecture

### Content Flow

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐
│  Tiptap  │ ──► │  Next.js │ ──► │  FastAPI  │ ──► │   MongoDB    │
│  Editor  │     │  Client  │     │  Service  │     │  + Meilisearch│
└──────────┘     └──────────┘     └───────────┘     └──────────────┘
```

1. User writes content in Tiptap editor.
2. Tiptap produces HTML.
3. Client sends HTML + plain text excerpt + metadata to API.
4. Server validates, sanitizes HTML (DOMPurify-equivalent on backend), stores in MongoDB.
5. Server indexes in Meilisearch (title, text content, tags, author, emotion, date).

### Content Security

- HTML is sanitized server-side to prevent XSS when rendering diary content.
- Allowed tags: `p, h1-h6, ul, ol, li, blockquote, pre, code, em, strong, a, img, table, thead, tbody, tr, th, td, hr, br`.
- Allowed attributes: `href, src, alt, class, target`.
- `rel="noopener noreferrer"` added to all links.
- Images are proxied through the server (not direct hotlinking).

### Comments

- Comments are plain text (no HTML formatting).
- Max length: 2000 characters.
- Comments are not indexed in Meilisearch.
- Diary owner can delete any comment on their diary.
- Comment author can delete their own comment.

### Likes and Bookmarks

- One like/bookmark per user per diary (enforced by unique compound index).
- Like and bookmark counts are denormalized on the diary document.
- Updates to counts happen via atomic `$inc` operations.

### Drafts

- Public diaries can exist as drafts (not published).
- Drafts are visible only to the author.
- Drafts are not indexed in Meilisearch.
- Drafts can have a `published_at` field set to null.
- Publishing sets `published_at` and indexes in search.

---

## 12. Private Diary Architecture

### Content Flow

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  Tiptap  │ ──► │  Crypto  │ ──► │  FastAPI  │ ──► │  MongoDB │
│  Editor  │     │  Layer   │     │  Service  │     │          │
└──────────┘     └──────────┘     └───────────┘     └──────────┘
                      │
                      ▼
             AES-256-GCM encrypt
             { title, content, tags }
```

1. User writes content in Tiptap editor.
2. Client-side crypto layer encrypts title + content + tags into a single JSON blob.
3. Client sends encrypted ciphertext + IV + salt to API.
4. Server stores encrypted data as-is.
5. Server does NOT index in Meilisearch.
6. Server stores only the encrypted payload with no access to plaintext.

### Restrictions

- No comments on private diaries.
- No likes on private diaries.
- No bookmarks on private diaries.
- Not searchable.
- Not included in any public listing.
- Not visible to administrators.
- Only visible to the owner in their own diary list.

### Metadata Exposure

The following metadata is stored in plaintext and visible:
- `created_at` (date)
- `updated_at` (date)
- `privacy` (set to "private")
- `user_id` (owner)

The title is **not** stored in plaintext. In the diary list UI, the client decrypts each title in-browser for display.

### Considerations

**Performance impact of listing private diaries:**
If a user has 200 private diaries, listing them requires 200 decryption operations on the client. Since AES-256-GCM decryption is fast (~100ns per operation in the browser), this is negligible.

**Search within private diaries:**
Not supported. The server has no access to plaintext. If we wanted client-side search, we'd need to download all encrypted entries, decrypt them, and search locally. This is feasible but costly. We defer this decision to a future iteration.

**Media in private diaries:**
Images uploaded for a private diary are stored in the same MinIO bucket but with a non-guessable UUID filename. The `media` document stores `diary_id` and `is_private: true`. Media URLs are time-limited signed URLs to prevent unauthorized access.

---

## 13. Search Architecture

### Index Configuration (Meilisearch)

**Index name:** `public_diaries`

```json
{
  "primaryKey": "id",
  "searchableAttributes": [
    "title",
    "content_text",
    "tags",
    "author_username"
  ],
  "filterableAttributes": [
    "tags",
    "emotion",
    "year",
    "month",
    "author_id",
    "created_at"
  ],
  "sortableAttributes": [
    "created_at",
    "updated_at",
    "like_count"
  ],
  "rankingRules": [
    "typo",
    "words",
    "proximity",
    "attribute",
    "sort",
    "exactness"
  ],
  "typoTolerance": {
    "enabled": true,
    "minWordSizeForTypos": {
      "oneTypo": 5,
      "twoTypos": 9
    }
  }
}
```

### Document Shape

```json
{
  "id": "ObjectId as string",
  "title": "string",
  "content_text": "string (plain text, no HTML)",
  "tags": ["string"],
  "emotion": "string | null",
  "author_id": "string",
  "author_username": "string",
  "year": 2026,
  "month": 6,
  "created_at": 1719299100,
  "updated_at": 1719299100,
  "like_count": 42,
  "comment_count": 7,
  "bookmark_count": 12
}
```

### Sync Strategy

**Real-time (on diary create/update/delete):**
- When a public diary is created, updated, or deleted, the API service immediately adds/updates/removes the document in Meilisearch.
- Private and draft diaries are never sent to Meilisearch.

**Periodic full re-sync (daily):**
- A background job queries all public diaries from MongoDB and re-indexes them in Meilisearch.
- This catches any out-of-sync data due to bugs or failures.
- Uses a timestamp-based approach: only re-index diaries updated since last sync.

### Search Query Flow

```
GET /api/v1/search?q=query&tags=tag1&emotion=happy&sort=relevance&page=1
    │
    ▼
FastAPI Service
    │
    ▼
Meilisearch Client
    ├─ filters: "tags IN [tag1] AND emotion = happy"
    ├─ sort: "created_at:desc" (or relevance-based)
    ├─ page: 1, hitsPerPage: 20
    │
    ▼
Meilisearch Response
    │
    ▼
FastAPI Service
    ├─ Enrich results with author info (if needed)
    ├─ Truncate content for excerpts
    └─ Return paginated response
```

### What Is NOT Searchable

- Private diaries (never indexed).
- Drafts (never indexed).
- Comments (not indexed).
- User profiles (not indexed — we could add this later).
- Diaries by banned users (filtered in search service).

---

## 14. Media Storage Architecture

### Storage Backend

| Environment | Backend | Rationale |
|-------------|---------|-----------|
| Development | MinIO (Docker) | S3-compatible API, easy local setup |
| Production | Cloudflare R2 | S3-compatible, no egress fees, global CDN |
| Production (alt) | AWS S3 | Widely supported, familiar |

### Upload Flow

```
Client
  │
  ├─ POST /api/v1/media/upload ──────────► FastAPI
  │   (multipart: file + diary_id)          │
  │                                        ├─ Validate file type & size
  │                                        ├─ Generate UUID filename
  │                                        ├─ Upload to MinIO/R2/S3
  │                                        ├─ Create media document in MongoDB
  │                                        └─ Respond with URL ──────────►
  │◄───────────────────────────────────────── { id, url, mime_type }
  │
  └─ Use URL in Tiptap editor
```

### Upload Restrictions

| Category | Max Size | Allowed Types |
|----------|----------|---------------|
| Images | 10 MB | JPEG, PNG, WebP, GIF, AVIF |
| Video | 50 MB | MP4, WebM |
| Audio | 30 MB | MP3, OGG, WAV, M4A |
| Other | Blocked | — |

### Access Control

**Public diary media:**
- Stored with a UUID filename.
- Served directly via MinIO/R2 with long-lived or no expiration.
- Also can be served through Nginx for caching.

**Private diary media:**
- Stored with a UUID filename.
- Served via signed URLs with short expiration (15 minutes).
- The API generates signed URLs on-demand when the owner views the diary.
- The signed URL is generated server-side using the MinIO/S3 SDK.
- The media endpoint checks that the requesting user owns the diary.

### Image Optimization

- On upload, the server generates optimized variants:
  - **Thumbnail**: 300px wide (for diary cards).
  - **Standard**: 1200px wide (for diary content).
  - **Original**: stored as-is (full resolution).
- Variants stored with suffixes: `uuid_thumb.webp`, `uuid_std.webp`.
- WebP format preferred for optimized variants (fallback to original format).

### Storage Path Convention

```
{diararchive-media}/
  users/
    {user_id}/
      {uuid}.{ext}
      {uuid}_thumb.webp
      {uuid}_std.webp
  ...
```

---

## 15. Notification Architecture

### Notification Types

| Type | Trigger | Content |
|------|---------|---------|
| `like` | User likes your diary | "{user} liked your diary {title}" |
| `comment` | User comments on your diary | "{user} commented on your diary {title}" |
| `follow` | User follows you | "{user} started following you" |
| `bookmark` | User bookmarks your diary | "{user} bookmarked your diary {title}" |

### Creation Flow

```
User Action (like, comment, follow, bookmark)
    │
    ▼
Service Layer
    ├─ Perform primary action (save like to DB)
    ├─ Check if recipient wants notifications for this action type
    ├─ Don't notify for user's own actions
    ├─ Create notification document in MongoDB
    └─ Publish event to Redis channel (if real-time needed)
```

### Delivery

**MVP (Polling):**
- Client polls `GET /notifications` every 30 seconds when the app is in focus.
- TanStack Query's `refetchInterval` handles this cleanly.
- Unread count shown in the navigation bar.

**Future (Real-time):**
- WebSocket connection via FastAPI WebSocket endpoint.
- Redis pub/sub for cross-process notification delivery.
- Client receives notifications as they happen.
- Fallback to polling if WebSocket disconnects.

### Notification Settings

Users can control:
- Which notification types to receive (like, comment, follow, bookmark).
- Whether to receive email notifications (requires email).
- Whether to receive notifications about their own activity.

### Cleanup

- Notifications older than 90 days are automatically deleted.
- A periodic background job runs daily to clean up old notifications.

---

## 16. Admin Dashboard Architecture

### Frontend Structure

```
/admin
├── /                    → Overview / stats dashboard
├── /reports             → Report queue
├── /users               → User management
├── /audit-logs          → Audit log viewer
└── /health              → System health
```

### Access Control

- Admin access is controlled by the `is_admin` boolean on the user document.
- The frontend conditionally renders the admin nav item based on user role.
- The backend verifies admin status on every admin endpoint.
- Admin endpoints return 403 for non-admin users.

### Report Queue

```
Status flow:
  pending → reviewed (admin marked as reviewed)
         → dismissed (admin deemed not actionable)
         → action_taken (admin took action, e.g., deleted diary or banned user)
```

Admin actions on reports:
- View the reported content.
- Delete the reported diary/comment.
- Ban the reported user.
- Mark report as reviewed/dismissed.
- Add resolution notes.

### User Management

- Search/filter users by username.
- View user details (join date, diary count, last login, report history).
- Ban/unban users.
- View user's public diaries.

### Audit Logs

- Immutable log of all admin actions.
- Filterable by admin, action type, date range.
- Includes IP address and user agent of the admin.

### System Health

- MongoDB connection status and query latency.
- Redis connection status.
- Meilisearch indexing health (last sync time, document count).
- MinIO/S3 storage usage.
- Background job status.

---

## 17. Deployment Architecture

### Development Environment

```
docker-compose up
    │
    ├─ nextjs       (port 3000, hot reload)
    ├─ fastapi      (port 8000, hot reload)
    ├─ mongodb      (port 27017)
    ├─ redis        (port 6379)
    ├─ meilisearch  (port 7700)
    └─ minio        (port 9000, console at 9001)
```

### Production Environment

```
Cloudflare (CDN, DDoS, SSL, caching)
    │
    ▼
Nginx (reverse proxy, rate limiting, gzip)
    │
    ├── / → Next.js (Docker container, port 3000)
    ├── /api/v1 → FastAPI (Docker container, port 8000)
    ├── /media → MinIO / R2 (direct or proxied)
    └── /_next/static → Next.js static files (long-lived cache)
```

### Docker Compose (Production)

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    depends_on: [nextjs, fastapi]

  nextjs:
    build: ./frontend
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://diaryarchive.com/api/v1

  fastapi:
    build: ./backend
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/diaryarchive
      - REDIS_URL=redis://redis:6379
      - MEILISEARCH_URL=http://meilisearch:7700
      - MINIO_ENDPOINT=minio:9000
      - SECRET_KEY=${SECRET_KEY}
    depends_on: [mongodb, redis, meilisearch, minio]

  mongodb:
    image: mongo:7
    volumes: ["mongo-data:/data/db"]

  redis:
    image: redis:7-alpine

  meilisearch:
    image: getmeili/meilisearch:v1
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
    volumes: ["meili-data:/meili_data"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: ["minio-data:/data"]
```

### Environment Variables

```
# Required
SECRET_KEY=<random 64-byte hex>
MEILI_MASTER_KEY=<random 32-byte hex>
MONGODB_URI=mongodb://mongodb:27017/diaryarchive
REDIS_URL=redis://redis:6379

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=<key>
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=diaryarchive-media

# Optional
SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
EMAIL_FROM=noreply@diaryarchive.com
```

### CI/CD (GitHub Actions)

**CI** (on push to any branch):
1. Lint: ruff, eslint, prettier.
2. Test: pytest, vitest.
3. Build: Docker image build (smoke test).

**CD** (on push to main):
1. Run CI steps.
2. Build production Docker images.
3. Push to container registry.
4. SSH into production server.
5. Pull new images and `docker-compose up -d`.

---

## 18. Scalability Strategy

### Current Target: 10,000 Users

At 10,000 users with typical usage patterns:
- ~5,000 active monthly users.
- ~500 daily active users.
- ~1,000 new diaries per day.
- ~5,000 new comments per day.
- ~10,000 new likes per day.

A single modern server (8 CPU cores, 32 GB RAM) running Docker Compose can handle this comfortably.

### Horizontal Scaling Path

Each service is designed to scale independently:

| Service | Scaling Strategy |
|---------|-----------------|
| Next.js | Multiple containers behind Nginx load balancer |
| FastAPI | Multiple containers behind Nginx (stateless by design) |
| MongoDB | Replica set → sharded cluster |
| Redis | Redis Cluster or standalone with failover |
| Meilisearch | Multi-node setup (paid feature) |
| MinIO/R2 | R2 is serverless; MinIO can scale horizontally |

### Caching Strategy

| Cache Target | Cache Location | TTL | Invalidation |
|-------------|----------------|-----|-------------|
| Public diary page | Redis | 5 min | On diary update/delete |
| Public diary list | Redis | 2 min | On new diary publish |
| User profile | Redis | 5 min | On profile update |
| Tag/emotion listings | Redis | 10 min | Time-based |
| Search results | Meilisearch cache | Instant | Automatic |
| Static assets | Cloudflare CDN | 1 year | Cache-busting URLs |

### Database Performance

- Indexes are designed before features (documented in [Section 6](#6-database-schema)).
- Denormalized counts (like_count, comment_count) avoid expensive aggregation queries.
- Paginated queries use cursor-based or skip/limit with proper indexes.
- `$inc` operations for counter updates (atomic, no race conditions).
- Read-heavy workloads: MongoDB read preferences can use secondaries.

### Media Optimization

- Images are resized and converted to WebP on upload.
- Thumbnails generated for list views (reduces bandwidth).
- CDN caching for all media.
- Signed URLs for private media (prevents unauthorized sharing).

---

## 19. Security Model

### Authentication

| Measure | Implementation |
|---------|---------------|
| Password hashing | Argon2id (memory: 64MB, iterations: 3, parallelism: 4) |
| Access tokens | JWT, RS256 or HS256, 15-minute expiry |
| Refresh tokens | Random 256-bit, stored as SHA-256 hash, 7-day expiry |
| Token rotation | New refresh token issued on each refresh (old one revoked) |
| Rate limiting | 5 auth attempts per minute per IP |
| Brute-force protection | Progressive delays after failed attempts |

### HTTP Security

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Restrict script sources, disallow inline scripts |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Minimal permissions (no geolocation, camera, etc.) |

### XSS Prevention

- All diary HTML is sanitized server-side (strip dangerous tags/attributes).
- CSP headers restrict inline scripts and unauthorized origins.
- React's built-in XSS protection (JSX escapes values).
- Tiptap's output is HTML, so server-side sanitization is essential.
- File uploads are validated by MIME type, not user-supplied extension.

### CSRF Prevention

- `SameSite=Strict` on cookies.
- State-changing endpoints require `Authorization` header (not cookie-dependent).
- `Content-Type` validation for API requests.
- Additional CSRF token for cookie-authenticated endpoints if needed.

### Injection Prevention

| Vector | Mitigation |
|--------|-----------|
| NoSQL injection | Motor uses parameterized queries; validate and sanitize all user input |
| HTML injection | Server-side HTML sanitization |
| Command injection | No shell commands in application code |
| Path traversal | Validate file paths, use UUID filenames |
| SSRF | Restrict outbound requests from API server |

### File Upload Security

- Validate MIME type (check magic bytes, not just extension).
- Maximum file sizes enforced (images: 10MB, video: 50MB, audio: 30MB).
- Files stored with UUID filenames (no user-controlled paths).
- Files scanned for malware (ClamAV integration optional).

### Data Encryption

| Data State | Encryption |
|------------|-----------|
| Passwords | Argon2id hashing |
| Email | AES-256-GCM at rest |
| Private diary content | AES-256-GCM client-side (E2E) |
| Public diary content | No additional encryption (encrypted at rest by MongoDB) |
| JWT tokens | Signed (not encrypted — payload is not sensitive) |
| Database | MongoDB encryption at rest (enterprise) or full-disk encryption |
| Backups | AES-256 encryption |

### Audit Logging

The following actions are always logged:
- Failed login attempts.
- Password changes.
- Account registration.
- Diary deletion.
- Comment deletion.
- All admin actions (view report, ban user, delete content).
- Report submissions.

---

## 20. Privacy Model

### Data Collection Minimality

| Collected | Purpose | Storage |
|-----------|---------|---------|
| Username | Identity, display | Plaintext |
| Password | Authentication | Argon2id hash |
| Email (optional) | Account recovery, security notices | AES-256-GCM encrypted |

### NOT Collected

- Real name
- Phone number
- Birthday / age
- Address / location
- Government ID
- Social media accounts
- Browser fingerprint
- IP address (logged temporarily for security, not stored permanently except in audit logs)
- Usage analytics (beyond basic server metrics)

### Data Visibility

| Data | Visible To |
|------|-----------|
| Public diary contents | Everyone |
| Private diary contents | Owner only (server cannot decrypt) |
| Username | Everyone |
| Email | Owner only (encrypted, not visible in UI) |
| Password hash | Nobody (one-way hash) |
| IP address | System (temporary in logs, deleted after 30 days) |

### Data Retention

| Data | Retention |
|------|-----------|
| User accounts | Until deleted by user or banned |
| Public diaries | Until deleted by owner or moderated |
| Private diaries | Until deleted by owner |
| Audit logs | 1 year |
| IP address logs | 30 days |
| Notifications | 90 days |
| Refresh tokens | Until expiration (7 days) or revocation |

### Account Deletion

- Users can delete their account at any time.
- Account deletion removes:
  - User document.
  - All diary documents (public and private).
  - All comments.
  - All likes and bookmarks.
  - All follow relationships.
  - All notifications.
  - All media files.
- Audit logs are retained (anonymized) for legal purposes.
- Username becomes available for reuse (configurable).

### Data Portability

- Users can export all their data:
  - Public diaries as JSON/Markdown.
  - Private diaries as encrypted JSON.
  - Profile data as JSON.
- Export is delivered as a zip file via email or download link.
- Private diary export includes the encrypted content + decryption instructions.

### Privacy for Minors

- No age verification (collecting birthdays would violate our privacy principles).
- We do not knowingly collect data of children under 13 (per COPPA).
- We recommend users be at least 13 years old to use the platform.
- No advertising, no behavioral tracking, no data selling.

### Third-Party Data Sharing

- **None.** DiaryArchive does not share data with third parties.
- Meilisearch is self-hosted (no cloud service sharing data).
- MinIO/R2 is used only for object storage (no data mining).
- No analytics providers (Google Analytics, etc.).
- No advertising networks.
- No social media integrations.

---

## Architecture Decision Records

The following ADRs should be written as separate documents in `docs/adr/`:

1. `001-e2e-encryption.md` — Why client-side AES-256-GCM with per-diary keys.
2. `002-mongodb-over-postgres.md` — Why MongoDB instead of PostgreSQL.
3. `003-meilisearch-over-elasticsearch.md` — Why Meilisearch instead of Elasticsearch.
4. `004-minio-over-local-filesystem.md` — Why object storage instead of local files.
5. `005-no-email-requirement.md` — Why email is optional and the tradeoffs.
6. `006-draft-system-design.md` — How drafts work for both public and private diaries.

---

> **Next Steps:**
> 1. Review this architecture document and provide feedback.
> 2. Identify any sections that need revision or clarification.
> 3. Once approved, we will begin implementation starting with the project skeleton, database setup, and authentication system.
