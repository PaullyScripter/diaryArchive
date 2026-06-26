# Milestone 14 — Polish & Performance

## Overview

**Goal:** The application is production-ready in terms of UX quality, accessibility, and performance. Lighthouse scores target 90+ across all metrics. The app passes WCAG AA compliance, runs smoothly on low-end devices, and has no UX friction.

**Purpose:** This milestone is the final quality gate before production deployment. It addresses technical debt, UX inconsistencies, accessibility gaps, and performance bottlenecks that accumulated across previous milestones. Every page, interaction, and screen size is reviewed and refined.

**Dependencies:** Milestone 13 (Media System) — all feature work is complete; this milestone is purely refinement.

---

## Architecture Impact

### Backend
- Redis caching layer for frequent queries (public feed, popular tags, user profiles)
- N+1 query audit and optimization across all endpoints
- Request logging middleware (structured logs with correlation IDs)
- MongoDB query analysis — verify all queries use indexes via `explain()`
- Rate limit tuning based on production-expected traffic patterns
- Cursor-based pagination for deep page efficiency

### Frontend
- WCAG AA compliance audit across all pages and components
- Skip-to-content navigation link
- Keyboard navigation enforcement on all interactive elements
- Lighthouse performance optimization (90+ all categories)
- Bundle analysis and code splitting for large dependencies
- Page transitions using CSS only (no JavaScript animation library)
- Lazy loading for all below-fold content
- next/font optimization for Inter (subsetting, caching)
- Empty state, error state, loading state audit across every data-driven component
- Responsive design verification at 320px, 768px, 1024px, 1440px

### Database
- Index audit — verify all queries use indexes (no COLLSCAN)
- Add missing indexes identified during explain() analysis
- Cursor-based pagination index support for diary listings

### API
- All endpoints reviewed for N+1 queries and fixed
- Caching headers added to appropriate responses
- Rate limit values finalized

### Security
- CSP headers audited and finalized
- Secrets scan on client-side code
- XSS penetration test on diary content
- CSRF protection verification

---

## Features

### F14.1 — Accessibility Audit and Remediation

**Category: Accessibility**

**Files (modified):** All pages and interactive components

**WCAG AA Audit checklist:**

| Criterion | WCAG Ref | Check |
|-----------|----------|-------|
| Non-text content | 1.1.1 | All images have meaningful alt text |
| Captions (multimedia) | 1.2.x | N/A — no video/audio |
| Info and relationships | 1.3.1 | Semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<header>`, `<footer>` |
| Meaningful sequence | 1.3.2 | Content order matches visual order |
| Sensory characteristics | 1.3.3 | No instructions based on shape/size/location alone |
| Use of color | 1.4.1 | No information conveyed solely by color |
| Audio control | 1.4.2 | N/A |
| Contrast (minimum) | 1.4.3 | All text has 4.5:1 ratio against background; large text 3:1 |
| Resize text | 1.4.4 | No loss of content when zoomed to 200% |
| Images of text | 1.4.5 | No images of text used |
| Reflow | 1.4.10 | No horizontal scroll at 320px viewport |
| Non-text contrast | 1.4.11 | UI components and focus indicators 3:1 |
| Text spacing | 1.4.12 | No loss of content with increased spacing |
| Content on hover/focus | 1.4.13 | Tooltips dismissible, hoverable, persistent |
| Keyboard | 2.1.1 | All functionality operable through keyboard |
| No keyboard trap | 2.1.2 | Focus never trapped in a component |
| Character key shortcuts | 2.1.4 | Single-key shortcuts configurable |
| Timing adjustable | 2.2.1 | No time limits on content |
| Pause/stop/hide | 2.2.2 | Moving/animating content can be paused |
| Three flashes | 2.3.1 | No flashing content |
| Bypass blocks | 2.4.1 | Skip-to-content link at top of every page |
| Page titled | 2.4.2 | Every page has a unique, descriptive `<title>` |
| Focus order | 2.4.3 | Tab order follows visual order |
| Link purpose (in context) | 2.4.4 | Link text describes destination |
| Multiple ways | 2.4.5 | Site has search, nav, sitemap |
| Headings and labels | 2.4.6 | Descriptive headings and form labels |
| Focus visible | 2.4.7 | Visible focus ring on all interactive elements |
| Language of page | 3.1.1 | `<html lang="en">` |
| On input | 3.2.2 | Form submission does not change context unexpectedly |
| Consistent navigation | 3.3.3 | NavBar and Footer consistent across pages |
| Consistent identification | 3.3.4 | Same components have same labels |
| Error identification | 3.3.1 | Form errors described clearly in text |
| Labels or instructions | 3.3.2 | All form fields have labels |
| Error suggestion | 3.3.3 | Error suggestions provided when possible |
| Error prevention | 3.3.4 | Delete actions require confirmation |
| Parsing | 4.1.1 | No duplicate IDs; valid HTML |
| Name, role, value | 4.1.2 | All custom components have ARIA roles and names |
| Status messages | 4.1.3 | Live regions for loading/error states |

### F14.2 — Skip-to-Content Link (Frontend)

**File:** `frontend/src/components/layout/skip-link.tsx`

```typescript
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:ring-2 focus:ring-primary"
    >
      Skip to content
    </a>
  );
}
```

- Placed as the very first element in `<body>` (before NavBar)
- Hidden by default, visible on Tab key focus
- Scrolls to `<main id="main-content">` on click
- All layout files updated: `(main)/layout.tsx`, `(auth)/layout.tsx`, `admin/layout.tsx`

### F14.3 — Keyboard Navigation Audit (Frontend)

Ensure all interactive elements are keyboard-accessible:

- Dropdown menus: Enter opens, arrow keys navigate, Escape closes
- Dialogs: Focus trapped inside, Escape closes, focus returns to trigger on close
- Tabs: Tab between tablist and panel, arrow keys between tabs
- Tooltips: Enter/Escape show/hide
- Infinite scroll / Load More: button focusable and operable with keyboard
- Custom selects and comboboxes: full keyboard support (type-ahead, arrow navigation)
- Focus order audit: Tab through every page, verify logical order
- Visible focus `:focus-visible` ring on every interactive element

### F14.4 — Screen Reader Testing (Frontend)

Test all pages with:
- **NVDA (Windows)**: Full workflow — register, create diary, read, comment, like, settings
- **VoiceOver (macOS)**: Same workflow — verify announcements, navigation, form interactions
- **Issues to catch**: Missing ARIA labels, unannounced dynamic content, focus management gaps, incorrect heading hierarchy

Fix all issues found during testing:

| Issue | Expected Behavior |
|-------|-------------------|
| Dynamic content updates (like count) | Announce via `aria-live="polite"` |
| Loading states | Announce "Loading..." via live region |
| Error messages | Associate with `aria-describedby` on form fields |
| Dialog open | Move focus to first focusable element |
| Dialog close | Return focus to trigger element |
| Page navigation | Announce page title via `aria-live` |

### F14.5 — Color Contrast Verification (Frontend)

**File:** `frontend/src/app/globals.css`

Verify all color pairs meet WCAG AA:
- Text on background: 4.5:1 minimum
- Large text (18px+ bold or 24px+ regular): 3:1 minimum
- UI components and focus indicators: 3:1 minimum
- Both light and dark themes tested

Specific contrast checks:

| Pair | Light | Dark | Ratio | Pass? |
|------|-------|------|-------|-------|
| `--text-primary` on `--background` | #1a1a1a on #faf8f5 | #f0ece8 on #1c1816 | 15.8:1 / 12.4:1 | ✓ |
| `--text-secondary` on `--background` | #6b6560 on #faf8f5 | #a09892 on #1c1816 | 5.2:1 / 6.7:1 | ✓ |
| `--text-tertiary` on `--background` | #9e9892 on #faf8f5 | #6b6560 on #1c1816 | 2.8:1 / 3.5:1 | ✗ (increase to 4.5:1 for body text, or use only for decorative text) |
| `--primary` on `--background` | #b8735a on #faf8f5 | #d4927a on #1c1816 | 3.8:1 / 4.8:1 | ✓ (large text OK) |
| `--destructive` on `--background` | #c44a4a on #faf8f5 | #c44a4a on #1c1816 | 4.9:1 / 6.1:1 | ✓ |
| Focus ring on any background | #b8735a | #d4927a | 3:1+ | ✓ |

If `--text-tertiary` fails, increase contrast to meet 4.5:1 for body text usage, or restrict it to decorative-only.

### F14.6 — Reduced Motion Preferences (Frontend)

Respect `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- Disables all CSS animations and transitions
- Page transitions (F14.9) skipped
- Loading skeleton pulse animations disabled
- Hover effects (scale, shadow) applied without transition
- Like button heart animation disabled

### F14.7 — Lighthouse Performance Audit (Frontend)

**Target scores:** Performance ≥90, Accessibility ≥95, Best Practices ≥95, SEO ≥100

| Category | Current | Target | Actions |
|----------|---------|--------|---------|
| Performance | ~65-75 | ≥90 | Code splitting, image optimization, lazy loading, font optimization |
| Accessibility | ~80-85 | ≥95 | A11y audit fixes, skip-link, ARIA improvements |
| Best Practices | ~85-90 | ≥95 | HTTPS, no mixed content, modern image formats |
| SEO | ~90-95 | 100 | Meta tags, semantic HTML, heading hierarchy |

**Performance optimization checklist:**

1. **Eliminate render-blocking resources**: Inline critical CSS, defer non-critical JS
2. **Enable text compression**: gzip/brotli for all text responses (Nginx config — M15)
3. **Preload key resources**: Hero images, fonts via `<link rel="preload">`
4. **Reduce unused CSS**: Purge Tailwind unused styles in production build
5. **Optimize images**: All user-uploaded images → WebP, lazy load below-fold
6. **Reduce JavaScript**: Split large dependencies (Tiptap, date-fns, recharts)
7. **Efficient cache policy**: Static assets cached for 1 year, API responses cached with `stale-while-revalidate`
8. **Minimize main-thread work**: Defer non-critical third-party scripts
9. **Reduce DOM size**: Target <500 DOM nodes, <30 depth
10. **Use next/font with `display: swap`**: Already configured, verify

### F14.8 — Bundle Analysis & Code Splitting (Frontend)

**File:** `frontend/next.config.ts`

```typescript
// next.config.ts
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

module.exports = withBundleAnalyzer({
  // existing config
});
```

Run: `ANALYZE=true npm run build`

**Code splitting plan:**

| Package | Size | Strategy |
|---------|------|----------|
| `@tiptap/*` | ~150KB gzip | Dynamic import in diary editor page only (not in main bundle) |
| `date-fns` | ~70KB | Tree-shake to only imported functions; or migrate to `date-fns/locale` |
| `recharts` (admin charts) | ~200KB | Dynamic import in admin page only |
| `@radix-ui/*` | ~50KB total | Tree-shaken by bundler; verify no unused imports |
| `lucide-react` | ~100KB | Use `dynamicIconImports` for tree-shaking |
| `react` / `react-dom` | ~130KB | Use production builds; preload critical chunks |

**Implementation:**
- Diary editor page uses dynamic import: `const TiptapEditor = dynamic(() => import("@/components/editor/TiptapEditor"), { ssr: false })`
- Admin charts: `const AdminCharts = dynamic(() => import("@/components/admin/Charts"))`
- Image gallery: `const ImageGallery = dynamic(() => import("@/components/editor/ImageGallery"))`

### F14.9 — Page Transitions (Frontend)

**File:** `frontend/src/app/layout.tsx` (CSS only, no JS animation library)

```css
@layer utilities {
  .page-enter {
    opacity: 0;
    transform: translateY(4px);
  }
  .page-enter-active {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 200ms ease-out, transform 200ms ease-out;
  }
}
```

- Each page wrapper gets a CSS animation on mount (opacity fade-in + subtle slide-up)
- Duration: 200ms, easing: ease-out
- Respects `prefers-reduced-motion` (no animation when enabled)
- Implementation: Add `animate-in` class on page mount via `useEffect` or Next.js layout animations

No JavaScript animation library (framer-motion, GSAP) — CSS only. This keeps bundle size small and respects system preferences natively.

### F14.10 — Empty / Error / Loading State Audit (Frontend)

Audit every data-driven component for all three states:

| Component | Empty State | Error State | Loading State |
|-----------|-------------|-------------|---------------|
| Homepage Latest Diaries | "No diaries yet. Be the first to share your thoughts." | "Couldn't load diaries. Retry." | 6 skeleton cards |
| Random Diary | "No diaries yet." with CTA to write | "Couldn't load random diary." with Retry | Skeleton card |
| Diary Reader | 404 (not found) | "Couldn't load this diary." with Retry | Skeleton layout |
| Comments Section | "No comments yet. Start the conversation." | "Couldn't load comments." with Retry | 3 skeleton lines |
| Explore/Search | "No diaries match your filters. Try different terms." | "Couldn't load results." with Retry | Skeleton grid |
| Notifications | "No notifications yet. Interact with the community!" | "Couldn't load notifications." with Retry | Skeleton list |
| My Diaries | "No diaries yet. The blank page is waiting." + Write button | "Couldn't load your diaries." with Retry | Skeleton cards |
| Settings | N/A (static content) | "Couldn't save changes." with Retry | Skeleton form (on load) |
| Profile (user) | "No diaries yet." | "Couldn't load profile." with Retry | Skeleton header + grid |
| Admin Dashboard | "No data yet." | "Couldn't load stats." with Retry | Skeleton cards |
| Image Gallery | "No images uploaded yet." | "Couldn't load images." with Retry | Skeleton thumbnails |
| Admin Reports | "No pending reports." | "Couldn't load reports." with Retry | Skeleton table |
| Followers/Following | "No followers yet." / "Not following anyone yet." | "Couldn't load list." with Retry | Skeleton list |

All empty states should:
- Have a clear, helpful message (not just "No results")
- Include a call to action when appropriate (Write button, Explore link, Follow suggestion)
- Have an illustration or icon (optional, nice-to-have)

All error states should:
- Show a clear error message (not technical stack trace)
- Include a Retry button that re-fetches the data
- Not leave the page in a broken state

All loading states should:
- Use skeleton components matching the approximate shape of the content
- Use `aria-hidden="true"` so screen readers don't announce skeleton text
- Animate with pulse (respecting reduced motion)

### F14.11 — Responsive Design Verification (Frontend)

Test and fix at four breakpoints:

| Breakpoint | Device | Issues to Check |
|------------|--------|-----------------|
| 320px | iPhone SE | No horizontal scroll, tap targets ≥44px, readable text size |
| 768px | iPad | Side-by-side layouts work, nav is not squished |
| 1024px | Desktop | Full layout, no excessive whitespace |
| 1440px | Wide Desktop | Max-width containers stop expanding |

**Common responsive fixes:**
- NavBar: hamburger menu threshold from `md` down to `sm` if necessary
- Diary cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (verify at each breakpoint)
- Profile page: avatar and stats stack vertically at 320px
- Admin sidebar: hidden on <768px, hamburger toggle
- Image gallery: 2-column at 320px (instead of 1) to avoid excessive scrolling
- Editor toolbar: wraps to 2 rows on small screens
- Tables (admin): horizontal scroll on small screens, or card layout
- Font sizes: minimum 16px on mobile (prevents iOS zoom on input focus)

### F14.12 — Device Testing (Frontend)

Physical device testing:
- **iPhone (Safari)**: 12 Pro Max, SE — test registration, diary creation, scrolling, image upload
- **Android (Chrome)**: Pixel 6, Samsung Galaxy — same workflow
- **iPad / Tablet**: Verify landscape and portrait orientations

Issues to catch:
- Touch target sizes <44px
- iOS Safari 100vh issue (use `dvh` or `svh` units)
- Input zoom on focus (minimum 16px font size)
- Search bar auto-focus on mobile (don't open keyboard automatically)
- Bottom sheet instead of dropdown on mobile for selects

### F14.13 — N+1 Query Audit (Backend)

**Files:** All endpoint handlers and services

Audit every endpoint for N+1 query patterns:

| Endpoint | Pattern | Fix |
|----------|---------|-----|
| GET /diaries (list) | For each diary, query author separately | Use `$lookup` aggregation or pre-load all authors with `$in` |
| GET /diaries/{id} | Query diary, then query author separately | Same as above; or embed author data |
| GET /notifications | For each notification, query source diary/comment | Enrich with aggregation pipeline |
| GET /users/{username}/diaries | Query diaries, then count total separately | Use `$facet` for paginated results + count in one query |
| GET /me/diaries | Same pattern as user diaries | Same fix |
| GET /admin/reports | Query reports, then for each, query reporter and target diary | Aggregation with `$lookup` |
| GET /search | For each result, query author | Enrich in application layer with `$in` |

**Fix approach:**
```python
# Before (N+1)
diaries = await diary_repo.find_public_feed(filters)
for diary in diaries:
    author = await user_repo.get_by_id(diary.author_id)  # N queries
    diary.author = {"username": author.username, "avatar_path": author.avatar_path}

# After (2 queries total)
diaries = await diary_repo.find_public_feed(filters)
author_ids = list(set(d.author_id for d in diaries))
authors = await user_repo.find_by_ids(author_ids)  # 1 query
author_map = {str(a.id): a for a in authors}
for diary in diaries:
    author = author_map.get(str(diary.author_id))
    diary.author = {"username": author.username, "avatar_path": author.avatar_path}
```

### F14.14 — Redis Caching (Backend)

**File:** `backend/app/core/cache.py`

```python
from redis import asyncio as aioredis
from app.core.config import settings

redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

async def get_cached(key: str) -> str | None:
    return await redis.get(key)

async def set_cached(key: str, value: str, ttl: int = 60):
    await redis.setex(key, ttl, value)

async def invalidate_pattern(pattern: str):
    cursor = 0
    while True:
        cursor, keys = await redis.scan(cursor, match=pattern, count=100)
        if keys:
            await redis.delete(*keys)
        if cursor == 0:
            break
```

**Caching plan:**

| Data | Key Pattern | TTL | Invalidation |
|------|-------------|-----|-------------|
| Public feed (page 1) | `feed:public:page:1` | 30s | On diary create/update/delete |
| Popular tags | `tags:popular` | 300s | On diary create (tag used) |
| Emotions with counts | `emotions:counts` | 300s | On diary create/delete |
| Random diary | `diary:random` | 300s | On diary create/delete |
| User profile (public) | `profile:{username}` | 60s | On profile update |
| User stats | `stats:{user_id}` | 60s | On diary create/delete, follow/unfollow |
| Admin stats | `admin:stats` | 120s | On admin action |
| Year archive counts | `archive:year:{year}` | 3600s | On diary create with that year |

### F14.15 — Rate Limit Review (Backend)

**File:** `backend/app/core/security.py`

Review and finalize rate limit values:

| Endpoint | Current Limit | Final Limit | Rationale |
|----------|-------------|-------------|-----------|
| POST /auth/register | 5/min/IP | 3/min/IP | Prevent account creation abuse |
| POST /auth/login | 10/min/IP | 10/min/IP | Standard for login |
| POST /auth/refresh | 20/min/IP | 30/min/IP | Legitimate token rotation |
| POST /auth/request-password-reset | 3/hr/email | 3/hr/email | Prevent reset spam |
| POST /auth/reset-password | 5/hr/token | 5/hr/token | Prevent brute force on reset token |
| POST /diaries | 30/min | 20/min | Diary creation is not time-critical |
| PUT /diaries | 30/min | 30/min | Editing is normal |
| POST /media/upload | 30/min | 15/min | Prevent storage DoS |
| POST /api/v1/comments | — | 20/min | Prevent comment spam |
| POST /api/v1/likes | — | 60/min | Like spam has limited impact |
| POST /api/v1/follow | — | 30/min | Prevent follow spam |
| GET /api/v1/search | — | 60/min | Prevent search scraping |

### F14.16 — MongoDB Index Verification (Backend)

Run `explain()` on every query path:

```python
async def verify_indexes():
    # In test suite or admin health check
    db = await get_database()
    queries = [
        # (collection, pipeline/filter, expected_index)
        ("diaries", {"privacy": "public", "published_at": {"$lte": datetime.utcnow()}}, "privacy_published_at"),
        ("diaries", {"user_id": ObjectId("..."), "privacy": {"$in": ["public", "draft"]}}, "user_privacy"),
        ("notifications", {"user_id": ObjectId("..."), "read_at": None}, "user_unread"),
        # ... all query patterns
    ]
    for collection_name, filter_query, expected_index in queries:
        coll = db[collection_name]
        result = await coll.find(filter_query).explain()
        stage = result.get("queryPlanner", {}).get("winningPlan", {})
        if stage.get("stage") == "COLLSCAN":
            logger.warning(f"COLLSCAN on {collection_name} with filter: {filter_query}")
```

Add any missing indexes found:

| Collection | New Index | Reason |
|-----------|-----------|--------|
| `comments` | `{ diary_id: 1, created_at: 1 }` | Comment listing on diary page |
| `likes` | `{ diary_id: 1 }` | Counting likes per diary |
| `notifications` | `{ user_id: 1, created_at: -1 }` | Notification listing |
| `notifications` | `{ user_id: 1, read_at: 1 }` | Unread notification count |

### F14.17 — Request Logging (Backend)

**File:** `backend/app/middleware/logging_middleware.py`

```python
import structlog
import uuid
from time import perf_counter

logger = structlog.get_logger()

async def logging_middleware(request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    start = perf_counter()
    
    response = await call_next(request)
    
    duration = perf_counter() - start
    logger.info("request", 
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration * 1000, 2),
        ip=request.client.host,
        user_agent=request.headers.get("user-agent", ""),
    )
    
    response.headers["X-Request-ID"] = request_id
    return response
```

- Structured JSON logging via `structlog`
- Each request gets a unique `request_id` (returned in response header)
- Logs: method, path, status, duration, IP, user agent
- Sensitive data (passwords, tokens) filtered from log output
- Error logs at ERROR level, normal requests at INFO level
- Slow requests (>500ms) logged at WARNING level

### F14.18 — Security Review (Backend + Frontend)

**CSP Headers (verify):**
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' (verify need for 'unsafe-inline' — Next.js requires it)
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.minio.example.com;
font-src 'self' data:;
connect-src 'self' https://*.minio.example.com;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
```

**Secrets audit:**
- Search for hardcoded keys, tokens, passwords in frontend source
- Verify `NEXT_PUBLIC_*` variables are truly public-safe
- Check that MinIO access keys are server-side only
- Verify no API keys in client-side bundle

**XSS test vectors (diary content):**
```
<script>alert('xss')</script>
<img src=x onerror=alert('xss')>
<a href="javascript:alert('xss')">click</a>
<svg onload=alert('xss')>
<div style="background:url(javascript:alert('xss'))">
```

**CSRF protection:**
- Verify all state-changing endpoints require Bearer token (not cookie-only)
- Verify SameSite=Strict on all cookies
- Verify no CORS misconfiguration allows cross-origin writes

---

## File Structure

### New Files
```
frontend/src/
├── components/
│   └── layout/
│       └── skip-link.tsx              # Skip-to-content accessibility link
├── hooks/
│   └── use-intersection-observer.ts   # Intersection Observer for lazy loading
└── styles/
    └── animations.css                 # Page transitions, reduced motion (imported in layout)
backend/app/
├── middleware/
│   └── logging_middleware.py          # Request logging middleware
└── core/
    └── cache.py                       # Redis caching helpers (get_cached, set_cached, invalidate)
```

### Modified Files
```
frontend/src/
├── app/layout.tsx                     # Add SkipLink, lazy loading JS, page transition CSS
├── app/globals.css                    # Reduced motion, contrast fixes, animation utilities
├── app/(main)/layout.tsx             # Add id="main-content" to <main>
├── app/(auth)/layout.tsx             # Add id="main-content" to main div
├── app/admin/layout.tsx              # Add id="main-content"
├── app/not-found.tsx                 # Verify a11y, contrast
├── app/error.tsx                     # Verify a11y, contrast
├── next.config.ts                    # Bundle analyzer config, image optimization
├── components/
│   ├── layout/navbar.tsx             # Keyboard nav, ARIA labels, focus management
│   ├── layout/footer.tsx             # Semantic HTML
│   ├── diary/diary-card.tsx          # Loading/empty/error states, a11y
│   ├── diary/diary-card-list.tsx     # Loading/empty/error states
│   ├── shared/avatar.tsx             # Alt text, fallback a11y
│   ├── shared/tag-badge.tsx          # Keyboard nav for clickable tags
│   ├── shared/emotion-badge.tsx      # Screen reader text
│   ├── auth/password-strength.tsx    # ARIA live region for updates
│   ├── providers/auth-provider.tsx    # Loading state
│   ├── shared/protected-route.tsx    # Redirect announcement
│   ├── diary/diary-form.tsx          # Form validation a11y
│   ├── editor/tiptap-editor.tsx      # Dynamic import, a11y, keyboard
│   ├── editor/image-gallery.tsx      # Dynamic import
│   ├── admin/*.tsx                   # Dynamic imports for charts
│   └── notifications/*.tsx           # A11y audit
├── hooks/
│   ├── use-diaries.ts                # Verify loading/error/empty states
│   ├── use-user.ts                   # Same
│   ├── use-notifications.ts          # Same
│   └── use-media.ts                  # Same
├── lib/
│   ├── api/client.ts                 # Request/response logging interceptor
│   └── media/validation.ts           # Client-side validation improvements
└── store/
    ├── auth-store.ts                 # Error handling review
    └── diary-store.ts                # Error handling review

backend/app/
├── main.py                           # Register logging middleware, cache init
├── api/v1/endpoints/
│   ├── diaries.py                    # Add caching, N+1 fix
│   ├── users.py                      # Add caching, N+1 fix
│   ├── auth.py                       # Rate limit review
│   ├── media.py                      # Rate limit review
│   ├── notifications.py              # Add caching, N+1 fix
│   ├── search.py                     # Rate limit review
│   └── admin.py                      # Add caching
├── repositories/
│   ├── diary_repo.py                 # Index-optimized queries, cursor pagination
│   ├── user_repo.py                  # Batch find_by_ids for N+1 fix
│   └── notification_repo.py          # Index-optimized queries
├── services/
│   ├── diary_service.py              # Cache invalidation on create/update/delete
│   └── user_service.py               # Cache invalidation on profile update
└── core/
    └── config.py                     # Rate limit values as settings constants
```

---

## Database Changes

### New Indexes

| Collection | Index | Command |
|-----------|-------|---------|
| `comments` | `{ diary_id: 1, created_at: 1 }` | `createIndex({ diary_id: 1, created_at: -1 })` |
| `comments` | `{ user_id: 1, created_at: -1 }` | `createIndex({ user_id: 1, created_at: -1 })` |
| `likes` | `{ diary_id: 1 }` | `createIndex({ diary_id: 1 })` |
| `likes` | `{ user_id: 1, diary_id: 1 }` | `createIndex({ user_id: 1, diary_id: 1 }, { unique: true })` |
| `bookmarks` | `{ diary_id: 1 }` | `createIndex({ diary_id: 1 })` |
| `bookmarks` | `{ user_id: 1, diary_id: 1 }` | `createIndex({ user_id: 1, diary_id: 1 }, { unique: true })` |
| `follows` | `{ follower_id: 1, following_id: 1 }` | `createIndex({ follower_id: 1, following_id: 1 }, { unique: true })` |
| `notifications` | `{ user_id: 1, created_at: -1 }` | `createIndex({ user_id: 1, created_at: -1 })` |
| `notifications` | `{ user_id: 1, read_at: 1 }` | `createIndex({ user_id: 1, read_at: 1 })` |
| `media` | `{ user_id: 1, created_at: -1 }` | `createIndex({ user_id: 1, created_at: -1 })` |
| `media` | `{ diary_id: 1 }` | `createIndex({ diary_id: 1 })` |
| `reports` | `{ status: 1, created_at: -1 }` | `createIndex({ status: 1, created_at: -1 })` |
| `audit_logs` | `{ created_at: -1 }` | `createIndex({ created_at: -1 })` |
| `audit_logs` | `{ admin_id: 1, created_at: -1 }` | `createIndex({ admin_id: 1, created_at: -1 })` |

### Migrations
- Run `ensure_indexes()` in `main.py` startup (idempotent, safe)
- No data migrations needed

---

## API Endpoints

No new endpoints. Existing endpoints get:
- Caching headers on response
- Optimized query patterns
- Rate limit adjustments
- Logging middleware

---

## Frontend

### Pages (No new pages — all existing pages audited)

### Components (No new components — existing components refined)

### Accessibility Map

| Component | A11y Feature | Implementation |
|-----------|-------------|----------------|
| All | Skip-to-content link | `<SkipLink />` as first element in body |
| All | Page title | `export const metadata = { title: "..." }` on each page |
| NavBar | ARIA labels | `aria-label="Main navigation"`, `aria-current="page"` |
| NavBar (mobile) | Hamburger | `aria-expanded`, `aria-controls`, `aria-label="Toggle navigation"` |
| NavBar (dropdown) | Keyboard | Arrow keys, Enter to open, Escape to close, `role="menu"` |
| DiaryCard | Semantic | `<article>`, `<h2>` for title, `<time>` for timestamp |
| DiaryCard | ARIA | `aria-label="Read diary: {title}"` on clickable card |
| DiaryReader | Semantic | `<article>`, `<h1>` for title, proper heading hierarchy |
| Form fields | Labels | Visible `<label>` elements (not placeholder-only) |
| Form fields | Errors | `aria-describedby` linking to error message |
| Form fields | Required | `aria-required="true"` |
| Button | Loading | `aria-busy="true"`, button text replaced with spinner |
| Dialog | Focus trap | Focus locked inside dialog, returned on close |
| Dialog | ARIA | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Tabs | ARIA | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls` |
| Progress bar | ARIA | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| Live region | Status | `aria-live="polite"` for loading, success messages |
| Live region | Errors | `aria-live="assertive"` for error toasts |
| Images | Alt text | All `<img>` have meaningful `alt` (empty alt for decorative) |
| Icons | Screen reader | `<span aria-hidden="true">` for decorative icons; visible text for meaning |

### Responsive Design

| Page | 320px | 768px | 1024px | 1440px |
|------|-------|-------|--------|--------|
| Homepage | 1-col grid, hamburger nav, stacked | 2-col grid, nav visible | 3-col grid, full layout | 3-col grid, max-width centered |
| Diary Reader | Full-width text, padding 16px | max-w-prose (65ch) | max-w-prose (65ch) | max-w-prose (65ch) |
| Explore/Search | 1-col results, stacked filters | 2-col results, horizontal filters | 3-col results | 3-col results |
| Profile | Stacked header, 1-col diaries | Side header, 2-col diaries | Side header, 3-col diaries | Side header, 3-col |
| Settings | Full-width form | Centered max-w-lg | Centered max-w-lg | Centered max-w-lg |
| Admin | Hamburger sidebar, stacked cards | Sidebar visible, 2-col cards | Full sidebar, 3-col cards | Full sidebar, 3-col |
| Editor | Full-width, toolbar wraps | Full-width, toolbar 2 rows | max-w-4xl, toolbar visible | max-w-4xl |
| Media Gallery | 2-col thumbnails | 3-col thumbnails | 4-col thumbnails | 4-col thumbnails |

---

## Backend

### Services (Modified)
- `diary_service.py`: Cache invalidation on create/update/delete; N+1 enrichment fix; cursor pagination support
- `user_service.py`: Cache invalidation on profile update; batch author loading
- `notification_service.py`: Index-optimized queries; N+1 enrichment fix

### Caching Strategy
- Read-through cache pattern: check Redis → miss → query DB → populate Redis → return
- Write-through invalidation: on mutation, delete relevant cache keys
- Cache key namespace: `{resource}:{identifier}` (e.g., `feed:public:1`, `profile:moonwriter`)
- TTL varies by data volatility (30s for feed, 300s for tags, 60s for profiles)

### Logging
- Structured JSON logs via `structlog`
- Fields: timestamp, level, request_id, method, path, status, duration_ms, ip, user_agent
- Error logs include exception traceback
- Slow requests (>500ms) logged at WARNING with `slow: true`

---

## Security

### Authentication
- No changes. Auth system from M04 is already secure.

### Authorization
- No changes. All endpoints already enforce ownership.

### Privacy
- All empty states avoid revealing existence of data (e.g., "No diaries" on profile doesn't distinguish between never-written and all-private)

### OWASP
- CSP headers finalized with restrictive policy
- All user content sanitized (server-side HTML sanitization from M06)
- XSS vectors tested against diary content rendering
- CSRF protection verified on all state-changing endpoints
- Rate limits reviewed and tightened where appropriate
- No secrets exposed in client-side bundle (verified by bundle analysis)

---

## Performance

### Lighthouse Results (Target)

| Metric | Target | Implementation |
|--------|--------|----------------|
| First Contentful Paint (FCP) | <1.5s | Preload critical assets, inline CSS |
| Largest Contentful Paint (LCP) | <2.5s | Optimize hero images, lazy load below-fold |
| Total Blocking Time (TBT) | <200ms | Code splitting, reduce JS bundle |
| Cumulative Layout Shift (CLS) | <0.1 | Set explicit dimensions on images, skeleton placeholders |
| Speed Index | <3.0s | Critical CSS, font optimization |
| Time to Interactive (TTI) | <3.5s | Defer non-critical JS, preconnect to origins |

### Query Performance

| Query | Index Used | Avg Time | Optimization |
|-------|-----------|----------|-------------|
| Public feed (page 1) | `privacy_published_at` | <5ms | Redis cached |
| Public feed (page 10) | `privacy_published_at` | <20ms | Cursor pagination |
| Diary by ID | `_id` | <2ms | Primary key lookup |
| User by username | `username` | <2ms | Unique index |
| User's diaries | `user_privacy` | <5ms | Covered query |
| Notifications list | `user_created` | <5ms | Paginated |
| Unread notification count | `user_read` | <2ms | Covered query |
| Popular tags aggregation | `privacy_published_at` + `$group` | <50ms | Cached 5min |
| Search (Meilisearch) | N/A | <50ms | External search engine |

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_feed_cached` | Unit | Cached feed returns same data as DB query |
| `test_cache_invalidated_on_create` | Unit | New diary invalidates feed cache |
| `test_cache_invalidated_on_delete` | Unit | Delete diary invalidates feed cache |
| `test_n_plus_one_feed` | Integration | Feed endpoint makes exactly 2 DB queries (diaries + authors) |
| `test_n_plus_one_notifications` | Integration | Notification list makes exactly 2 DB queries |
| `test_cursor_pagination` | Unit | Cursor pagination returns correct next_cursor |
| `test_rate_limit_limits` | Integration | Verify all rate limit values are correctly applied |
| `test_index_usage_feed` | Integration | Feed query uses `privacy_published_at` index (explain) |
| `test_index_usage_notifications` | Integration | Notification query uses `user_created` index |
| `test_request_id_in_response` | Unit | Response includes X-Request-ID header |
| `test_logging_middleware` | Integration | Request is logged with expected fields |
| `test_slow_logging` | Integration | Requests >500ms logged at WARNING level |
| `test_xss_sanitization_persistent` | Unit | XSS vectors stored, sanitized on retrieval |
| `test_csp_headers` | Integration | All responses include CSP headers |
| `test_no_collscan` | Integration | explain() on all query patterns returns no COLLSCAN |
| `test_cursor_pagination_deep_page` | Unit | Page 1000 with cursor is faster than skip |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Skip link visible on focus | Unit | Tab to first element shows skip link |
| Skip link scrolls to main | Unit | Click skip-link scrolls to #main-content |
| All pages have unique titles | Unit | Check metadata.title on every page |
| Keyboard nav — NavBar | Manual/Unit | Tab through nav items, Enter activates |
| Keyboard nav — Dropdown | Manual | Arrow keys navigate items, Escape closes |
| Keyboard nav — Dialog | Manual | Focus trap inside, Escape closes, focus returns |
| Tab order logical | Manual | Tab through full page, verify order |
| Color contrast check | Automated | axe/Playwright contrast check on all pages |
| Reduced motion disables animation | Manual | Enable prefers-reduced-motion, verify no animations |
| Lighthouse performance | Automated | ≥90 all metrics in CI |
| Lighthouse accessibility | Automated | ≥95 in CI |
| Empty states all pages | Manual | Check each page/component with no data |
| Error states all pages | Manual | Simulate network error, verify Retry works |
| Loading states all pages | Manual | Slow network throttle, verify skeletons |
| Responsive — 320px | Manual | Verify no horizontal scroll, tap targets ≥44px |
| Responsive — 768px | Manual | Verify layout adapts |
| Responsive — 1440px | Manual | Verify max-width containment |
| Mobile device — iOS Safari | Manual | Test full workflow on physical iPhone |
| Mobile device — Android Chrome | Manual | Test full workflow on physical Android |
| Bundle size regression | Automated | CI check: main bundle < 200KB gzip |
| Page transition animation | Manual | Verify fade-in on navigation |
| Diary XSS rendering | Unit | Store XSS vector, render, verify no script execution |

---

## Documentation

- `docs/accessibility.md` — New document: accessibility features, testing results, conformance report
- `docs/performance.md` — New document: optimization decisions, Lighthouse results, bundle analysis
- `docs/architecture.md` — Update with caching strategy, logging architecture
- `docs/api.md` — Update with caching headers documentation, rate limit values
- `README.md` — Update with setup instructions, environment variables, deployment steps (see F14.19)
- `docs/security.md` — Update with CSP configuration, XSS prevention
- `docs/milestones/milestone-14.md` — This document

### F14.19 — README and Documentation Update

Update `README.md` with:
- Project overview and architecture
- Prerequisites (Node 20+, Python 3.12+, Docker)
- Quick start: `make dev`
- Environment variables table (all variables, defaults, descriptions)
- Available Makefile targets
- Docker Compose services
- Testing: `make test`
- Deployment: reference `docs/deployment.md`

Create `docs/deployment.md`:
- Production Docker Compose setup
- Environment variable configuration
- Nginx reverse proxy setup
- SSL certificate (Cloudflare or Let's Encrypt)
- Backup and restore procedures
- Monitoring and alerting
- Scaling considerations

---

## Acceptance Criteria

1. Lighthouse scores: Performance ≥90, Accessibility ≥95, Best Practices ≥95, SEO 100.
2. Skip-to-content link is the first focusable element on every page; clicking it scrolls to main content.
3. All interactive elements are keyboard accessible (Tab, Enter, Escape, Arrow keys).
4. All form fields have visible labels and error messages linked via `aria-describedby`.
5. Screen reader (NVDA/VoiceOver) can complete the full workflow: register → create diary → read → comment → settings.
6. Color contrast in both themes meets WCAG AA 4.5:1 for body text and 3:1 for large text.
7. `prefers-reduced-motion: reduce` disables all animations, transitions, and page transitions.
8. Every data-driven component has distinct and helpful empty, error, and loading states.
9. The app is fully usable at 320px width with no horizontal scroll and 44px minimum tap targets.
10. The app works correctly on physical iOS Safari and Android Chrome devices.
11. All API endpoints have been audited for N+1 queries; no endpoint makes more than 2 queries per list item.
12. Redis caching is active for feed, tags, emotions, random diary, profiles, and stats.
13. Rate limits are finalized and correctly enforced for all endpoints.
14. All MongoDB queries use indexes (verified by explain() — no COLLSCAN).
15. Request logging middleware is active with structured JSON logs and request IDs.
16. CSP headers are correct; no secrets in client-side code; XSS vectors are blocked.
17. Bundle size: main JS bundle <200KB gzip; dynamic imports for editor, gallery, charts.
18. Page transitions (CSS fade-in) are smooth and respect reduced motion.
19. README and documentation are comprehensive and accurate.
20. All tests pass (`make test`).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Accessibility issues found late | Medium | Start audit early; automated checks in CI prevent regression |
| Performance optimization degrades UX | Low | Measure before/after each change; user testing validates |
| Redis cache invalidation misses | Low | TTL provides eventual consistency; manual cache flush endpoint for admin |
| Responsive issues on un-tested device | Medium | Test on physical iPhone + Android; CSS grid handles most cases |
| Screen reader compatibility varies | Medium | Test with both NVDA (Windows) and VoiceOver (macOS) |
| Bundle splitting breaks SSR | Low | Verify dynamic imports are properly handled by Next.js |
| Rate limit tuning too aggressive | Low | Monitor error rates post-deployment; adjust based on real traffic |

---

## Future Considerations

- Milestone 15 (Production Deployment) uses the performance optimizations and logging infrastructure built here.
- Automated a11y testing in CI (axe-core in Playwright) prevents future regressions.
- Page transitions could be enhanced with View Transitions API when browser support is sufficient.
- Internationalization (i18n) would require revisiting all accessibility labels and empty state messages.
- Performance budgets should be added to CI to prevent regression.
- Server-side rendering optimizations (ISR, streaming) for further performance gains.
- Core Web Vitals monitoring via Real User Monitoring (RUM) in production.
