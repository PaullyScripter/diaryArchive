# DiaryArchive Implementation Roadmap

> Status: Draft — v0.1
> Last updated: 2026-06-25

---

## Roadmap Philosophy

### Principles

1. **Foundation before features.** Database connections, auth, and layouts come before any user-facing functionality. Every feature is built on solid, tested infrastructure.

2. **Each milestone is independently testable.** At the end of every milestone, you can run a command, open a browser, and verify the milestone works. No milestone depends on uncompleted future work.

3. **Small, focused milestones.** No milestone exceeds ~5 days of work. If a feature is too large, it gets split into smaller milestones.

4. **Vertical slices, not horizontal layers.** Each milestone delivers a complete, working slice of functionality (backend + frontend + tests), not just "all the backend work" or "all the frontend work."

5. **Working software over documentation.** Documentation is written alongside code, not before it. Each milestone includes test updates and documentation updates.

### Phases Overview

```
Phase 1: Foundation
  M1: Skeleton & Dev Environment
  M2: Backend Foundation
  M3: Frontend Foundation
  M4: Authentication

Phase 2: Core Diaries
  M5: User Profiles
  M6: Public Diaries
  M7: Rich Text Editor
  M8: Private Diaries & Encryption

Phase 3: Community
  M9: Social Features
  M10: Explore & Search
  M11: Notifications

Phase 4: Operations
  M12: Admin Dashboard
  M13: Media System
  M14: Polish & Performance

Phase 5: Launch
  M15: Production Deployment
```

---

## Phase 1: Foundation

### Milestone 1: Project Skeleton & Development Environment

**Goal:** A working monorepo with all services running in Docker, CI passing, and a health check confirming everything connects.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Create monorepo directory structure | `frontend/`, `backend/`, `docker/`, `docs/`, `scripts/`, `.github/` |
| Create `backend/` scaffold | FastAPI app, `pyproject.toml`, `requirements.txt`, `Dockerfile` |
| Create `docker-compose.yml` | Services: MongoDB 7, Redis 7, Meilisearch, MinIO |
| Implement `GET /api/v1/health` | Returns status of MongoDB, Redis, MinIO connections |
| Add configuration module | `pydantic-settings` with `.env` loading |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create `frontend/` scaffold | `npx create-next-app@latest` with App Router, TypeScript, Tailwind |
| Add `Dockerfile` for Next.js | Multi-stage build for production |
| Create basic root layout | HTML shell with metadata |
| Add `.env.example` | Document all required environment variables |

**DevOps tasks:**

| Task | Detail |
|------|--------|
| Create `Makefile` | Targets: `dev`, `test`, `lint`, `build`, `clean` |
| Create `.gitignore` | Python, Node.js, Docker patterns |
| Create `.github/workflows/ci.yml` | Lint (ruff, eslint), typecheck, build Docker images |
| Create `docker-compose.prod.yml` | Production overrides (resource limits, restart policies) |

**Verification:**
```bash
make dev
# Services start successfully
curl http://localhost:8000/api/v1/health
# Returns: { "status": "healthy", "checks": { "mongodb": "ok", "redis": "ok", "minio": "ok" } }
curl http://localhost:3000
# Returns: Next.js welcome page
make test
# All lint and type checks pass
```

**Estimated effort:** 2-3 days

---

### Milestone 2: Backend Foundation

**Goal:** Database models, error handling, middleware, and utility functions are in place. No user-facing functionality yet, but the backend is fully structured and testable.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement Motor connection manager | Singleton with connection pooling, retry logic |
| Implement Redis connection manager | Async redis client with connection pool |
| Create MongoDB schema documents | All 12 collections with indexes (run `createIndexes` on startup) |
| Implement exception hierarchy | `NotFoundException`, `PermissionDeniedException`, `ValidationException`, `RateLimitException`, `AuthenticationException` |
| Implement exception handlers | Consistent JSON error responses for all exception types |
| Add CORS middleware | Configured for development (localhost:3000) |
| Add request ID middleware | UUID per request, returned in response header |
| Add CSP headers middleware | Security headers on all responses |
| Create repository base class | Common CRUD operations (get_by_id, find, create, update, delete) |
| Implement user repository | Full CRUD for users collection |
| Create Pydantic models for users | Request/response models with validation |

**Verification:**
```bash
make dev
# Services start cleanly
curl http://localhost:8000/api/v1/health
# All services healthy
# Manual: connect to MongoDB, verify all indexes exist
# Manual: trigger a 404 error, verify JSON error response format
make test
# Repository tests pass (using test MongoDB)
```

**Estimated effort:** 3-4 days

---

### Milestone 3: Frontend Foundation

**Goal:** The frontend has a working design system, theme toggling, layout components, and responsive structure. Pages render with placeholder content.

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Install and configure shadcn/ui | Init with custom CSS variables for DiaryArchive palette |
| Implement CSS custom properties | All design tokens: colors, fonts, radii, shadows, transitions |
| Create ThemeProvider | Dark/light/system mode with localStorage persistence |
| Create RootLayout | HTML shell, font loading, metadata tags |
| Create MainLayout | NavBar + content area + Footer |
| Create AuthLayout | Centered card layout for login/register |
| Create EditorLayout | Minimal chrome layout for diary editor |
| Create AdminLayout | Sidebar + top bar + content area |
| Implement NavBar | Logo, links, auth-aware state (login/register vs. avatar dropdown) |
| Implement Footer | Site name, links, attribution |
| Create base shadcn/ui theme | Button, Card, Input, Dialog, Dropdown styled with DiaryArchive tokens |
| Build color palette CSS | Light and dark theme variables |
| Build typography system | Font face declarations, text size utilities |
| Add responsive breakpoint testing | Verify layout at 375px, 768px, 1024px, 1440px |
| Create 404 page | Custom "This page doesn't exist" page |
| Create error page | Generic error boundary for client errors |

**Verification:**
```bash
make dev
open http://localhost:3000
# NavBar renders, theme toggles between dark/light
# Resize to mobile — layout collapses appropriately
# Visit /nonexistent — 404 page renders
make test
# Component snapshot tests pass
# Responsive tests pass (Playwright)
```

**Estimated effort:** 3-4 days

---

### Milestone 4: Authentication

**Goal:** Users can register, log in, log out, and maintain sessions. Protected routes work on the frontend.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement Argon2id password hashing | Using `passlib` with bcrypt compatibility |
| Implement JWT access token creation | 15-minute expiry, signed with HS256 |
| Implement refresh token creation/verification | Random 256-bit, stored as SHA-256 hash |
| Implement `POST /api/v1/auth/register` | Username + password + optional email |
| Implement `POST /api/v1/auth/login` | Verify credentials, issue tokens |
| Implement `POST /api/v1/auth/refresh` | Rotate refresh token, issue new access token |
| Implement `POST /api/v1/auth/logout` | Revoke refresh token |
| Implement `GET /api/v1/auth/me` | Return current user profile |
| Implement `PUT /api/v1/auth/change-password` | Verify old, hash new, revoke all sessions |
| Implement `POST /api/v1/auth/request-password-reset` | Send email (requires SMTP config) |
| Implement `POST /api/v1/auth/reset-password` | Verify token, change password |
| Add rate limiting to auth endpoints | 5 attempts/minute/IP |
| Create FastAPI dependency `get_current_user` | Verify JWT, load user, check ban status |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create login page | Username + password form, validation, error display |
| Create register page | Username + password + optional email form, privacy warning |
| Implement auth store (Zustand) | User state, access token in memory, login/logout actions |
| Implement API client base | Axios or fetch wrapper with auth header injection |
| Implement auth provider | Check `/auth/me` on app load, redirect to login if unauthenticated |
| Implement protected route wrapper | Redirect to login if not authenticated |
| Implement auto-refresh interceptor | On 401, call `/auth/refresh`, retry original request |
| Implement cookie handling | Refresh token cookie management |
| Create password strength indicator | Visual feedback during registration |
| Add "if you lose your username" warning | Below the register form |

**Auth tests:**

| Test | Description |
|------|-------------|
| `test_register_success` | Valid registration returns 201 with user and tokens |
| `test_register_duplicate_username` | Returns 409 |
| `test_register_weak_password` | Returns 422 |
| `test_login_success` | Valid credentials return 200 with tokens |
| `test_login_wrong_password` | Returns 401 |
| `test_refresh_token` | Valid refresh token returns new access token |
| `test_refresh_rotated` | Old refresh token is invalidated after use |
| `test_logout` | Refresh token is revoked |
| `test_banned_user_cannot_login` | Returns 403 |

**Verification:**
```bash
# Backend
curl -X POST localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"ValidPass123"}'
# Returns 201 with user + access_token

# Frontend
open http://localhost:3000/register
# Register a user, get redirected to /
# Log out, log back in
# Refresh the page — session persists

make test
# All auth tests pass
```

**Estimated effort:** 4-5 days

---

## Phase 2: Core Diaries

### Milestone 5: User Profiles

**Goal:** Users have customizable profiles. Profile pages are public and readable.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement `GET /api/v1/users/{username}` | Public profile with stats |
| Implement `PUT /api/v1/users/me` | Update own profile fields |
| Implement `PUT /api/v1/users/me/email` | Add/change/remove email with verification |
| Create user profile Pydantic models | Request validation for all profile fields |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create profile page | Public profile view with bio, stats, diary list placeholder |
| Create settings page | Tabs: Profile, Account, Preferences |
| Build settings/Profile tab | Avatar upload, about, quote, feeling fields |
| Build settings/Account tab | Email management, password change, danger zone |
| Build settings/Preferences tab | Theme selection, notification toggles |
| Implement avatar upload widget | Click to upload, crop, preview |
| Create user avatar component | Circular, fallback initials, size variants |
| Create stats display component | Diary/follower/following count |

**Verification:**
```bash
# Visit /profile/testuser — public profile page renders
# Visit /settings — update profile fields, see changes on profile page
# Change theme in settings — theme persists across page reload
make test
```

**Estimated effort:** 3-4 days

---

### Milestone 6: Public Diaries

**Goal:** Users can create, read, update, and delete public diary entries. The homepage shows the latest public diaries.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement `POST /api/v1/diaries` | Create public diary with HTML sanitization |
| Implement `GET /api/v1/diaries/{id}` | Read public diary with author enrichment |
| Implement `PUT /api/v1/diaries/{id}` | Update with ownership check |
| Implement `DELETE /api/v1/diaries/{id}` | Delete with ownership check + cascade |
| Implement `GET /api/v1/diaries` | List public diaries with filters: sort, tags, emotion, year, month |
| Implement `GET /api/v1/diaries/random` | Random public diary via ObjectId range |
| Implement HTML sanitization | Server-side strip dangerous tags/attributes |
| Implement `GET /api/v1/me/diaries` | Current user's diaries (all privacy levels) |
| Add diary repository | CRUD with all index-aware queries |
| Add diary stats update | Atomic `$inc` on create/delete |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create DiaryCard component | Title, excerpt, author, tags, emotion, stats |
| Create DiaryCardList component | Grid of DiaryCards with loading/empty states |
| Create diary reader page | Full diary view with author info, metadata, action buttons |
| Create my diaries page (`/me`) | Dashboard listing user's diaries |
| Create diary list on profile | Tab on profile showing user's public diaries |
| Create homepage sections | "Latest Diaries" grid, "Random Diary" widget |
| Implement loading skeletons | Card-shaped skeletons while data loads |
| Implement empty states | "No diaries yet" messaging |
| Implement diary store (Zustand) | Current diary state, edit/draft management |

**Verification:**
```bash
# Create a public diary via the UI
# View it on the diary reader page
# Edit the diary — changes persist
# Delete the diary — it disappears from listings
# Verify it appears on the homepage "Latest" section
# Verify the random diary widget works
make test
```

**Estimated effort:** 4-5 days

---

### Milestone 7: Rich Text Editor

**Goal:** The Tiptap editor is fully integrated with formatting, autosave, drafts, and media uploads.

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Install and configure Tiptap | With essential extensions |
| Create TiptapEditor component | Configurable, extensible wrapper |
| Implement toolbar | Bold, Italic, Underline, Strikethrough, H1-H3, Blockquote, Code Block, Bullet List, Ordered List, Check List |
| Implement floating toolbar | Appears on text selection |
| Implement markdown shortcuts | `#` for H1, `**bold**`, `*italic*`, `> quote`, `- list` |
| Implement keyboard shortcuts | Ctrl+B, Ctrl+I, Ctrl+Shift+7 for list, etc. |
| Implement autosave | Save to server on 30 seconds of inactivity |
| Implement draft system | Auto-save drafts, show draft indicator |
| Create diary editor page (`/diary/new`) | Title input + Tiptap editor + settings panel |
| Create diary edit page (`/diary/[id]/edit`) | Pre-populated with existing content |
| Implement settings panel | Privacy selector, tags input, emotion dropdown, comments toggle |
| Implement tags autocomplete | Suggest existing tags as user types |
| Add word/character count | Displayed in bottom bar |
| Add unsaved changes warning | Before navigating away |
| Implement undo/redo | Tiptap built-in history |

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement draft endpoints | Drafts as diaries with `privacy: "draft"` |
| Update diary endpoints for drafts | Drafts only visible to owner |
| Implement autosave endpoint | `PUT /api/v1/diaries/{id}` with draft support |

**Verification:**
```bash
# Open /diary/new — editor renders
# Write with formatting — bold, italic, headings all work
# Type # at start of line — converts to heading
# Type **bold** — converts to bold
# Leave for 30 seconds — "Saved" indicator appears
# Close the browser tab, reopen /diary/new — draft is restored
# Publish the diary — appears on homepage
make test
```

**Estimated effort:** 4-5 days

---

### Milestone 8: Private Diaries & Encryption

**Goal:** Users can create private diaries with true end-to-end encryption. Server cannot read the content.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement private diary storage | Store `encrypted_data` blob as-is, no decryption |
| Update diary CRUD for private diaries | Validate encrypted_data present, content_html absent |
| Privacy filter on all diary queries | Private diaries excluded from public listings |
| Encrypted field validation | Ensure required encrypted fields are present when privacy=private |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create crypto utilities module | Web Crypto API wrapper |
| Implement master key generation | On first private diary creation |
| Implement master key encryption/decryption | With password-derived key (Argon2id) |
| Implement per-diary key derivation | HKDF from master key + salt |
| Implement diary encryption | AES-256-GCM of `{ title, content_html, tags }` |
| Implement diary decryption | On diary reader page load |
| Update editor for private mode | When privacy=private, encrypt before save |
| Update reader for private diaries | Decrypt in browser, render content |
| Update diary list for private diaries | Decrypt titles client-side for list display |
| Add privacy selector widget | Public / Private / Draft with clear explanation |
| Handle password change | Re-encrypt master key with new password |
| Handle password reset/forgot | Clear master key (data loss warning) |

**Verification:**
```bash
# Create a private diary — it should not appear on homepage or search
# Read the private diary — content is decrypted and displayed
# Verify server has no access:
#   - Check MongoDB document — content is ciphertext
#   - Check that search doesn't index it
# Change password — verify private diaries are still accessible
# Log out, log back in — private diaries still readable
make test
```

**Estimated effort:** 4-5 days

---

## Phase 3: Community

### Milestone 9: Social Features

**Goal:** Users can comment, like, bookmark, and follow. These are the community interaction primitives.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement comment CRUD | Create, list, delete with ownership checks |
| Implement like toggle | Create/delete with duplicate prevention |
| Implement bookmark toggle | Same pattern as likes |
| Implement follow/unfollow | Create/delete with self-follow prevention |
| Implement `GET /api/v1/me/likes` | User's liked diaries |
| Implement `GET /api/v1/me/bookmarks` | User's bookmarked diaries |
| Implement `GET /api/v1/users/{username}/followers` | Follower list |
| Implement `GET /api/v1/users/{username}/following` | Following list |
| Add `is_liked`/`is_bookmarked`/`is_following` enrichment | On diary and user responses |
| Implement stats updates | Atomic `$inc` on like/comment/bookmark/follow |
| Add comments_enabled/comments_locked checks | Prevent comments when disabled |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create comment section component | List, input, submit, delete |
| Create like button component | Heart icon, count, toggle animation |
| Create bookmark button component | Bookmark icon, toggle |
| Create follow button component | Follow/unfollow toggle on profile pages |
| Implement infinite comment loading | "Load more comments" button |
| Add comment count display | On diary cards and reader |
| Add like count display | With animation on toggle |
| Create "my likes" page | Grid of liked diaries |
| Create "my bookmarks" page | Grid of bookmarked diaries |
| Add followers/following lists | On profile pages |
| Create "following" feed section | Homepage section showing followed users' diaries |

**Verification:**
```bash
# Like a diary — heart fills, count increments
# Unlike — heart unfills, count decrements
# Comment on a diary — comment appears
# Delete a comment — shows as "[deleted]"
# Follow a user — appears in following list
# View following feed — shows their public diaries
# Bookmark a diary — appears in bookmarks page
make test
```

**Estimated effort:** 4-5 days

---

### Milestone 10: Explore & Search

**Goal:** Users can search and discover public diaries by tags, emotions, date, and full-text search.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Configure Meilisearch index | `public_diaries` with searchable/filterable/sortable attributes |
| Implement search indexing on create/update/delete | Real-time sync for public diaries |
| Implement `GET /api/v1/search` | Full-text search with filters, pagination, highlighting |
| Implement `GET /api/v1/tags/popular` | Most used tags from recent diaries (cached) |
| Implement `GET /api/v1/emotions` | Available emotions with counts (cached) |
| Implement periodic re-sync job | Daily full sync of all public diaries to Meilisearch |
| Add search result enrichment | Author data, stats on search results |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create explore page | Filter bar (tags, emotions, date) + search bar + results grid |
| Create tag cloud component | Clickable tag badges sized by popularity |
| Create emotion browser component | Emotion buttons with emojis and labels |
| Create date archive browser | Year/month selector for diary archive |
| Create search bar component | Text input with debounced search |
| Create pagination component | "Load More" button (no infinite scroll) |
| Update homepage sections | "Browse by Tags", "Browse by Emotions", "Browse by Year" link to explore |
| Add empty states for search/filter | Helpful messages when no results |
| Add tag filtering | Click tag → filter explore results |
| Add emotion filtering | Click emotion → filter explore results |

**Verification:**
```bash
# Publish a diary with specific tags — it appears in search for those tags
# Search for a word in the diary — it appears in results with highlighting
# Filter by tag — only matching diaries appear
# Filter by emotion — only matching diaries appear
# Browse by year/month — archive view works
# Verify private diaries NEVER appear in search
make test
```

**Estimated effort:** 4-5 days

---

### Milestone 11: Notifications

**Goal:** Users receive notifications when someone interacts with their content.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement notification creation service | Called by like/comment/follow/bookmark services |
| Implement `GET /api/v1/notifications` | Paginated list with unread-first sorting |
| Implement `GET /api/v1/notifications/unread-count` | Fast count for badge |
| Implement `PUT /api/v1/notifications/{id}/read` | Mark single as read |
| Implement `PUT /api/v1/notifications/read-all` | Batch mark read |
| Add notification preference checks | Respect user's notification toggles |
| Add self-action filter | Don't notify for own actions |
| Add notification cleanup | TTL index for 90-day auto-cleanup |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create notification center page | List of notifications grouped by date |
| Create notification item component | Icon, message, timestamp, read indicator |
| Create notification bell component | Icon with unread count badge |
| Implement mark-as-read | Click notification to mark read and navigate |
| Implement mark-all-read | Button in notification center |
| Implement notification polling | Refetch every 30 seconds via TanStack Query |
| Create empty state | "No notifications yet" |
| Add unread badge to nav | Show count on bell icon |

**Verification:**
```bash
# Like someone's diary — they receive a notification
# Comment on a diary — author receives a notification
# Follow a user — they receive a notification
# View notification center — list shows all notifications
# Click "Mark all as read" — badge disappears
# Verify own actions don't create notifications
make test
```

**Estimated effort:** 3-4 days

---

## Phase 4: Operations

### Milestone 12: Admin Dashboard

**Goal:** Administrators can moderate content, manage users, and monitor system health.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement `POST /api/v1/reports` | Submit report against diary/comment/user |
| Implement `GET /api/v1/admin/reports` | List with status filter |
| Implement `PUT /api/v1/admin/reports/{id}` | Update status, add resolution |
| Implement `GET /api/v1/admin/users` | List/search users with pagination |
| Implement `PUT /api/v1/admin/users/{id}/ban` | Ban/unban with reason |
| Implement `PUT /api/v1/admin/users/{id}/role` | Change admin status |
| Implement `GET /api/v1/admin/audit-logs` | Paginated audit log viewer |
| Implement `GET /api/v1/admin/stats` | Dashboard statistics |
| Implement `GET /api/v1/admin/health` | Service health check |
| Implement audit logging service | Log all admin actions automatically |
| Add admin-only middleware | Check `is_admin` on all admin endpoints |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Create admin layout | Sidebar navigation, top bar with admin badge |
| Create admin overview page | Stats cards: users, diaries, reports, storage |
| Create report queue page | Table of reports with status management |
| Create report review workflow | View reported content, take action |
| Create user management page | Search users, view details, ban/unban |
| Create audit log viewer | Filterable log table |
| Create system health page | Service status indicators |
| Add conditional admin nav | Only visible to admin users |

**Verification:**
```bash
# Submit a report — appears in admin queue
# As admin, review and resolve the report — status changes
# Ban a user — they cannot log in
# View audit logs — all admin actions are recorded
# Check system health — all services show green
make test
```

**Estimated effort:** 4-5 days

---

### Milestone 13: Media System

**Goal:** Users can upload images and other media to include in their diaries.

**Backend tasks:**

| Task | Detail |
|------|--------|
| Implement MinIO client | Async upload, download, delete operations |
| Implement `POST /api/v1/media/upload` | File upload with MIME validation, size limits, UUID naming |
| Implement `DELETE /api/v1/media/{id}` | Delete file from storage and database |
| Implement image optimization | Generate thumbnail and standard-size WebP variants |
| Implement MIME type validation | Check magic bytes, not file extension |
| Implement size validation | Reject files exceeding limits |
| Implement private media URL signing | Short-lived signed URLs for private diary media |
| Implement media cleanup on diary delete | Cascade delete associated media |

**Frontend tasks:**

| Task | Detail |
|------|--------|
| Implement image upload in Tiptap | Drag-and-drop, paste, file picker |
| Implement image upload progress | Progress bar during upload |
| Implement image resize in editor | Adjustable width within content |
| Implement image gallery | Browse uploaded images (future) |
| Add file type validation | Client-side check before upload |

**Verification:**
```bash
# Upload an image — it appears in the editor
# Drag-and-drop an image — uploads and inserts
# Publish diary with image — image renders in reader
# Create private diary with image — image has signed URL
# Delete diary — associated media is cleaned up
make test
```

**Estimated effort:** 3-4 days

---

### Milestone 14: Polish & Performance

**Goal:** The application is production-ready in terms of UX quality, accessibility, and performance.

**Tasks:**

| Category | Task |
|----------|------|
| **Accessibility** | Audit all pages for WCAG AA compliance |
| **Accessibility** | Add skip-to-content links |
| **Accessibility** | Verify keyboard navigation on all interactive elements |
| **Accessibility** | Test with screen reader (VoiceOver/NVDA) |
| **Accessibility** | Verify color contrast in both themes |
| **Accessibility** | Ensure reduced-motion preferences are respected |
| **Performance** | Lighthouse audit — target 90+ on all metrics |
| **Performance** | Bundle analysis — identify and split large dependencies |
| **Performance** | Image optimization — verify all images use WebP |
| **Performance** | Implement lazy loading for below-fold content |
| **Performance** | Add `next/font` optimization for Inter |
| **UX** | Review all empty states — are they helpful? |
| **UX** | Review all error states — are they clear? |
| **UX** | Review all loading states — are they smooth? |
| **UX** | Add page transitions (CSS only, no JS animation lib) |
| **UX** | Verify responsive design at 320px, 768px, 1024px, 1440px |
| **UX** | Test on actual mobile device (iOS Safari, Android Chrome) |
| **Backend** | Review all API endpoints for N+1 queries |
| **Backend** | Add Redis caching for frequent queries |
| **Backend** | Review rate limiting limits |
| **Backend** | Verify all MongoDB queries use indexes (explain()) |
| **Backend** | Add request logging for debugging |
| **Security** | Verify CSP headers are correct |
| **Security** | Verify no secrets in client-side code |
| **Security** | Verify all user inputs are validated |
| **Security** | Test XSS vectors in diary content |
| **Security** | Test CSRF protection |
| **Documentation** | Update README with setup instructions |
| **Documentation** | Document environment variables |
| **Documentation** | Document deployment steps |

**Verification:**
```bash
# Lighthouse: 90+ performance, 95+ accessibility, 95+ best practices
# Playwright accessibility tests pass
# Manual: keyboard-only navigation works on all pages
# Manual: screen reader reads all pages correctly
# Manual: all empty/error states render correctly
make test
# All tests pass
```

**Estimated effort:** 4-5 days

---

## Phase 5: Launch

### Milestone 15: Production Deployment

**Goal:** DiaryArchive is running in production behind Cloudflare with CI/CD, monitoring, and backups.

**Tasks:**

| Task | Detail |
|------|--------|
| Provision production server | VPS with Docker, 8GB+ RAM, SSD |
| Configure Cloudflare | DNS, SSL, DDoS protection, caching rules |
| Configure Nginx | Reverse proxy, rate limiting, SSL termination, gzip |
| Configure production Docker Compose | Resource limits, restart policies, logging drivers |
| Set up environment variables | All secrets in secure storage |
| Set up MongoDB replica set | 3-node replica set with authentication |
| Set up Redis persistence | AOF or RDB configuration |
| Set up MinIO for production | Or migrate to Cloudflare R2 |
| Configure GitHub Actions CD | Auto-deploy on push to main |
| Set up monitoring | Health checks, uptime monitoring, alerting |
| Set up backups | Daily MongoDB dumps, encrypted, stored off-server |
| Set up logging | Centralized log collection (Loki or similar) |
| Configure SMTP | Transactional email sending (password reset) |
| Run security audit | Review all configurations |
| Load test | Verify performance under simulated load |
| Soft launch | Limited user access for testing |
| Full launch | Open registration |

**Verification:**
```bash
# Visit https://diaryarchive.com — loads correctly
# Register, create diary, read diary — full flow works
# SSL certificate is valid
# Cloudflare is proxying traffic
# Backups are running
# Monitoring alerts are configured
```

**Estimated effort:** 5-7 days

---

## Summary Timeline

```
Milestone               Days   Phase
─────────────────────────────────────────
M1  Skeleton            3      Foundation
M2  Backend Foundation  4      Foundation
M3  Frontend Foundation 4      Foundation
M4  Authentication      5      Foundation
M5  User Profiles       4      Core
M6  Public Diaries      5      Core
M7  Rich Text Editor    5      Core
M8  Private Diaries     5      Core
M9  Social Features     5      Community
M10 Explore & Search    5      Community
M11 Notifications       4      Community
M12 Admin Dashboard     5      Operations
M13 Media System        4      Operations
M14 Polish & Perf       5      Operations
M15 Production Launch   7      Launch
─────────────────────────────────────────
Total                  ~70 days (~14 weeks)
```

### Critical Path

M1 → M2 → M4 → M6 → M7 → M8 → M10 → M15

Everything else can be parallelized or deferred:

- M3 (Frontend Foundation) can run alongside M2.
- M5 (Profiles) can run alongside M6.
- M9 (Social) and M11 (Notifications) can run in parallel.
- M12 (Admin) can run alongside M13.
- M14 (Polish) runs across all milestones continuously.

### Parallelization Strategy

| Track | Developer 1 | Developer 2 |
|-------|-------------|-------------|
| **Wave 1** | M1 Skeleton | M1 Skeleton |
| **Wave 2** | M2 Backend Foundation | M3 Frontend Foundation |
| **Wave 3** | M4 Authentication | M5 User Profiles |
| **Wave 4** | M6 Public Diaries | M7 Rich Text Editor |
| **Wave 5** | M8 Private Diaries | M9 Social Features |
| **Wave 6** | M10 Explore & Search | M11 Notifications |
| **Wave 7** | M12 Admin Dashboard | M13 Media System |
| **Wave 8** | M14 Polish & Performance | M14 Polish & Performance |
| **Wave 9** | M15 Production Launch | M15 Production Launch |

With two developers, the timeline compresses to ~9 weeks.

---

> **Next Steps:**
> 1. Review this roadmap and provide feedback.
> 2. Adjust milestone boundaries and priorities as needed.
> 3. Once approved, we begin with Milestone 1: Project Skeleton.
