# Final Engineering Audit — Pre-Milestone 09

**Reviewer:** Principal Engineer / Security Reviewer / Production Readiness  
**Date:** June 28, 2026  
**Scope:** Complete repository audit of all subsystems  
**Branch:** `feat/milestone-08-private-diaries`

---

## Executive Summary

DiaryArchive has a solid foundation. The core features (auth, public/private diaries, E2E encryption, profiles) are correctly implemented and tested. The architecture is well-designed and the implementation generally follows it. However, there are **significant gaps in infrastructure, accessibility, and code organization** that should be addressed before production deployment. The codebase is **ready to begin Milestone 09** as no findings block social feature implementation, but technical debt is accumulating.

---

## Repository Health Scores

| Category | Score | Explanation |
|----------|-------|-------------|
| **Architecture** | 72/100 | Well-defined layers. Violated in `discover.py` (endpoint hits DB directly), `auth.py` (no service layer), and `users.py:get_user_diaries`. Tag service bypasses repository. Otherwise, diaries/user endpoints follow the pattern. |
| **Backend** | 74/100 | Functional CRUD with proper validation. Solid test coverage (70 tests). Missing: structured logging, `response_model` on endpoints, N+1 in stats queries, `_optional_user` swallows exceptions. |
| **Frontend** | 68/100 | Working UX with good editor integration. Issues: 8 dead component files, 4 dead npm deps, no `React.memo` on list items, missing error boundary around editor, `dangerouslySetInnerHTML` now sanitized (C1 fix). |
| **Security** | 71/100 | Auth flows correct. Rate limiting present on most endpoints. JWT + refresh token rotation implemented. Issues: 5 hardcoded default secrets, missing CSP header, missing rate limits on 4 endpoints, no audit log writes, `bleach` is deprecated. |
| **Privacy** | 85/100 | E2E encryption correctly implemented. Private diary content never reaches server unencrypted. Encrypted data gated to owner only. Tags intentionally unencrypted per design. Minor: metadata leakage via ciphertext length, no data-loss warning on password reset. |
| **Performance** | 65/100 | Async Argon2 fixed (C4). Issues: `sanitize_html` runs synchronously in event loop, no `React.memo` on list items, `DiaryCard` re-renders on every parent change, `latestDiaries` not memoized on homepage, Meilisearch runs idle consuming RAM. |
| **Testing** | 55/100 | 70 backend tests pass. Good API coverage for auth + diaries + users. Issues: zero frontend tests, zero E2E tests, no service-layer tests, CI skips backend tests entirely, no Playwright setup. |
| **Accessibility** | 42/100 | Multiple HIGH issues: 5 modals missing ARIA attributes, 7 icon-only buttons without labels, no skip-to-content link, `text-subtle` fails WCAG AA contrast (~2.8:1), editor title input has no label. |
| **Documentation** | 65/100 | Well-written but documents ~60% more features than implemented. Architecture doc references non-existent files (init scripts, ADRs, deploy.yml). README references non-existent Makefile targets. API spec fully documents M9-M15 features not yet built. |
| **Infrastructure** | 52/100 | Dockerfiles mostly correct but `frontend/Dockerfile` has npm ci bug (missing lockfile), `requirements.txt` missing bleach/tinycss2. Nginx exists but not in any compose file. No health checks in prod compose. CI doesn't run backend tests. |
| **OVERALL** | **67/100** | Production-capable with security hardening + infra fixes + a11y remediation. Not production-ready today. |

---

## Critical Findings

### CF-1: Hardcoded Default Secrets
**Files:** `backend/app/core/config.py:23,27`
The app starts with insecure defaults (`secret_key: "change-me-in-production"`, `email_encryption_key: "0123456789abcdef..."`). A forgotten env var means all JWTs are forgeable.
**Fix:** Remove defaults. Validate on startup. **Effort:** 30min. **Blocks M09:** No.

### CF-2: Frontend Dockerfile npm ci Fails
**File:** `frontend/Dockerfile:5-6`
`COPY package.json ./` copies only `package.json` but `RUN npm ci` requires `package-lock.json`.
**Fix:** Add `COPY package-lock.json ./`. **Effort:** 5min. **Blocks M09:** No (dev workflow unaffected).

### CF-3: Backend requirements.txt Missing Dependencies
**Files:** `backend/requirements.txt` vs `backend/pyproject.toml:17-18`
`bleach` and `tinycss2` are in `pyproject.toml` but NOT in `requirements.txt` used by `Dockerfile`. Import fails in Docker containers.
**Fix:** Sync requirements.txt with pyproject.toml. **Effort:** 5min. **Blocks M09:** No (dev install uses pyproject.toml).

### CF-4: 8 Missing Repository Classes Needed for M9
**Files:** `backend/app/repositories/`
M9 (Social Features) requires `comment_repo.py`, `like_repo.py`, `bookmark_repo.py`, `follow_repo.py`, `notification_repo.py`. None exist. These must be created during M9.
**Fix:** Create as part of M9 implementation. **Effort:** 2-3 hours. **Blocks M09:** Yes — must be built during M9.

### CF-5: Missing `/diary/random` Route Page  
**Files:** Linked from `navbar.tsx:31` and `browse-sidebar.tsx:129`
The Random Diary link navigates to a 404 page. The API endpoint `/diaries/random` works, but no frontend page exists to call it.
**Fix:** Create `app/(main)/diary/random/page.tsx` that calls `useRandomDiary`. **Effort:** 30min. **Blocks M09:** No — not a social feature.

### CF-6: Dead Code (8 Files, ~515 Lines, 4 npm Deps)
**Dead files:** `diary-entry.tsx`, `diary-card-list.tsx`, `diary-form.tsx`, `diary-store.ts`, `use-autosave.ts`, `editor-layout.tsx`, `footer.tsx`, `stats-display.tsx`
**Dead npm deps:** `react-hook-form`, `zod`, `@hookform/resolvers`, `@tiptap/extension-floating-menu` (~27KB)
**Fix:** Remove dead files and deps. **Effort:** 30min. **Blocks M09:** No.

### CF-7: discover.py Bypasses All Architectural Layers
**File:** `backend/app/api/v1/endpoints/discover.py:9-42`
Both endpoints directly call `DatabaseManager.get_db()` and run raw MongoDB aggregation pipelines. No service, no repository.
**Fix:** Create `discover_service.py` or add methods to `diary_service.py`. **Effort:** 1 hour. **Blocks M09:** No.

### CF-8: auth.py Has No Service Layer
**File:** `backend/app/api/v1/endpoints/auth.py` (446 lines)
All auth endpoints contain business logic inline. No `auth_service.py` exists. Email encryption code is duplicated between `auth.py:39-58` and `encryption_service.py:10-25`.
**Fix:** Extract to `app/services/auth_service.py`. **Effort:** 3 hours. **Blocks M09:** No — can be deferred.

### CF-9: `_optional_user` Swallows All Exceptions
**File:** `backend/app/api/deps.py:24`
`except Exception: pass` hides database failures, config issues, and security bugs. Users silently become unauthenticated.
**Fix:** Catch only `AuthenticationException`. **Effort:** 5min. **Blocks M09:** No.

---

## High-Severity Findings

### HF-1: Nginx Not Connected to Any Compose File
Architecture doc describes Nginx as reverse proxy. nginx.conf exists at `docker/nginx/` but is not referenced by any docker-compose file. Production deployment is impossible without it.

### HF-2: CI Skips Backend Tests Entirely
70 tests exist and pass locally, but `.github/workflows/ci.yml` only lints the backend. Zero test execution in CI.

### HF-3: Backend Replicas in Prod Without Load Balancer
`docker-compose.prod.yml:39-40` sets `replicas: 2` for backend but no load balancer, no shared sessions, no sticky sessions. Two backends behind nothing won't work.

### HF-4: docker-compose.yml NEXT_PUBLIC_API_URL Is Wrong
Line 93: `NEXT_PUBLIC_API_URL=/api/v1` requires Nginx reverse proxy which doesn't exist in the compose stack. Should be `http://backend:8000/api/v1` for direct container-to-container.

### HF-5: 5 Modals Missing ARIA Attributes
Password decrypt prompt, preview modal, key setup modal (both steps) — all 5 modals lack `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handlers, and focus traps.

### HF-6: 7 Icon-Only Buttons Without aria-labels
Like, Bookmark, Share, Edit, Delete, Preview, and Lock buttons in diary reader and editor have no accessible text. Screen readers cannot identify them.

### HF-7: Color Contrast Failure
`--color-subtle` contrast ratio is ~2.8:1 (light) and ~3.5:1 (dark). Fails WCAG AA at all text sizes. Affects timestamp text, helper text, and secondary labels everywhere.

### HF-8: Skip-to-Content Link Missing
WCAG 2.4.1 requires a mechanism to bypass repeated blocks. No skip-to-content link exists.

### HF-9: `sanitize_html` Runs Synchronously in Async Handlers
`diary_service.py:149,280` calls `sanitize_html()` (CPU-bound HTML parsing) directly in async path. Should use `asyncio.to_thread()`.

### HF-10: Settings Theme Controls Disconnected
Changing theme in Settings saves to backend but never calls `ThemeProvider.setTheme()`. Theme change in Settings has no visual effect.

### HF-11: Duplicate `relativeTime` Function (3 Copies)
In `diary-card.tsx`, `diary-entry.tsx`, and `profile/[username]/page.tsx`. Should be in `lib/utils.ts`.

### HF-12: `text-subtle` Contrast Failure
Affects all timestamp text throughout the application.

---

## Medium-Severity Findings (Summary)

- **M1:** Response envelope inconsistency (`GET /` and `GET /health` don't use `{"data": ...}`)
- **M2:** `tag_service.py` bypasses repository layer (hits DB directly)
- **M3:** `user_service.py` imports non-existent `follow_repo` (always catches ImportError)
- **M4:** `get_my_diaries_stats` makes 4 count queries instead of 1 aggregation
- **M5:** `DiaryCard` not wrapped in `React.memo` — causes unnecessary re-renders
- **M6:** Homepage `latestDiaries` not memoized — new array reference every render
- **M7:** `me/page.tsx` useEffect dependency cycle on `decryptedTitles`
- **M8:** No `response_model` on any FastAPI endpoint (no automatic OpenAPI schema)
- **M9:** Password reset silently destroys encrypted data without warning
- **M10:** Rate limiter fails open when Redis down
- **M11:** `masterKeyMap` not cleared on logout
- **M12:** `email_encryption_key` not documented in `.env.example`
- **M13:** Architecture doc references 12+ non-existent files/scripts
- **M14:** README references non-existent Makefile targets
- **M15:** Meilisearch runs idle consuming RAM (never used by any code)
- **M16:** Auth endpoint timing side-channel enables user enumeration
- **M17:** Editor save error shows only "error" with no actionable message
- **M18:** `useDraft` `discard`/`clear` are identical functions
- **M19:** `useUpdateProfile` invalidates non-existent `["auth"]` query key (no-op)
- **M20:** `email_hash` computed with `hash_token` instead of `hash_email` in auth.py register

---

## Technical Debt Summary

### Short-Term Debt (should fix within M9-M10, ~15 hours)

| Item | Effort |
|------|--------|
| Extract `relativeTime` to shared utility | 10 min |
| Remove 8 dead files | 15 min |
| Remove 4 dead npm deps | 5 min |
| Create `/diary/random` page | 30 min |
| Add ARIA to 5 modals | 2 hours |
| Add aria-labels to 7 icon buttons | 30 min |
| Add skip-to-content link | 15 min |
| Fix `_optional_user` exception swallowing | 5 min |
| Fix docker-compose NEXT_PUBLIC_API_URL | 5 min |
| Fix frontend Dockerfile lockfile copy | 5 min |
| Sync requirements.txt with pyproject.toml | 5 min |
| Add `React.memo` to DiaryCard | 5 min |
| Memoize `latestDiaries` on homepage | 5 min |
| Fix settings theme disconnect | 30 min |
| Fix `sanitize_html` async wrapper | 15 min |

### Long-Term Debt (schedule for M14 Polish)

| Item | Est. Days |
|------|-----------|
| Extract auth service layer from auth.py (446 lines) | 1 day |
| Add response_model on all endpoints | 2 hours |
| Structured JSON logging with request IDs | 3 hours |
| Fix color contrast (text-subtle) | 1 hour |
| Add CSP header to middleware | 1 hour |
| Migrate bleach → nh3 | 1 hour |
| Add Redis caching for popular tags/emotions | 2 hours |
| Integrate Meilisearch or remove it | 4 hours |
| Add health checks to docker-compose | 30 min |
| Frontend test framework + crypto tests | 1 day |
| E2E Playwright smoke tests | 1 day |
| Nginx integration in compose + SSL config | 2 hours |
| Remove hardcoded default secrets | 30 min |
| MongoDB transactions for multi-collection ops | 2 hours |

---

## Production Readiness

**Would you ship this codebase today?** **No.**

What prevents shipping:

1. **Infrastructure is incomplete** — Nginx not integrated, docker-compose has misconfiguration, CI doesn't run tests, Dockerfile has bugs
2. **Accessibility is below WCAG AA** — Modals lack ARIA, color contrast fails, icon buttons are unlabeled
3. **Secrets are insecure by default** — Hardcoded defaults allow accidental insecure deployment
4. **No production monitoring** — No structured logging, no health check endpoints wired, no alerting

The application core (auth, diaries, encryption) is solid and could handle users. The infrastructure around it is not production-grade.

---

## Milestone 09 Readiness

**Recommendation: YES — proceed with Milestone 09.**

**Technical justification:**

1. All 4 previously-identified Critical issues from the M08 review are resolved
2. All 9 Critical findings in this audit affect infrastructure, code organization, or accessibility — NOT the core diary/social feature domain
3. M09 requires 8 new repository classes + service/endpoint layers — these must be built during M09 regardless
4. The existing architecture (services → repositories pattern) is proven and ready for M09 features
5. No finding blocks implementing comments, likes, bookmarks, or follows — the auth, diary, and user foundations are complete

**Recommended approach:** Address CF-4 (missing repositories) as the first step of M09, since they're prerequisites for the social features. Tackle short-term debt items in parallel during M09 implementation. Defer infrastructure hardening and accessibility remediation to M14 (Polish & Performance).

---

## Final Verdict

The DiaryArchive codebase is a well-structured project at approximately 40% feature completeness against the documented roadmap. The core (auth, diaries CRUD, E2E encryption, profiles, rich text editor) is correctly implemented and tested. The team should proceed with Milestone 09 while addressing short-term technical debt. The project is on track for its 14-week estimated timeline.
