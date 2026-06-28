# Engineering Review — DiaryArchive Pre-Milestone 09

**Reviewer:** Senior Staff Engineer / Technical Lead  
**Date:** June 28, 2026  
**Scope:** Full-stack production readiness review of all M1–M8 deliverables  
**Branch Reviewed:** `feat/milestone-08-private-diaries`

---

## Executive Summary

The DiaryArchive codebase has a solid foundation. The architecture is generally followed, the encryption implementation is cryptographically sound, and most critical flows work correctly. However, there are **4 critical issues** and **12 high-severity issues** that must be addressed before Milestone 09 begins.

**Verdict:** ❌ NOT READY for M09 — critical items must be fixed first.

---

## Critical Issues (Must Fix Before M09)

### C1. Stored XSS via Unsanitized diary Content

**File:** `frontend/src/app/(main)/diary/[id]/page.tsx:320`  
**Also:** `frontend/src/components/editor/editor-page.tsx:448-452`  

Diary content is rendered via `dangerouslySetInnerHTML` with **no client-side sanitization**. The backend sanitizes with `bleach`, but:
- Users can inject HTML via the source mode in the editor
- User-created custom CSS is injected as `<style>${customCss}</style>`
- CSS injection can exfiltrate data via `url()`, `@import`

**Fix:** Install `isomorphic-dompurify`, sanitize `displayHtml` before rendering. Strip CSS properties beyond a safe allowlist.

**Effort:** 2 hours  
**Risk if ignored:** Attackers can steal access tokens, session data, or redirect users.

---

### C2. Admin Routes Have No Auth Guard

**Files:** `frontend/src/app/admin/layout.tsx`, `frontend/src/app/admin/page.tsx`  

The admin layout renders children without checking `isAuthenticated` or `is_admin`. Any visitor can navigate to `/admin` and see the admin interface.

**Fix:** Wrap admin layout in a `ProtectedRoute` that checks `user.is_admin`.

**Effort:** 30 minutes  
**Risk if ignored:** Open admin access, even if backend endpoints are protected.

---

### C3. No Encryption Key Management Tests

**Files:** `backend/tests/test_api/` — zero tests for `PUT/GET /users/me/encryption-key`  

The M8 encryption key storage/retrieval endpoints have no test coverage. A regression here breaks all private diaries silently.

**Fix:** Add tests for key storage, retrieval, unauthorized access, invalid payload, and clean retrieval when no key exists.

**Effort:** 2 hours  
**Risk if ignored:** Broken encryption key flow goes undetected until user data is lost.

---

### C4. Blocking Argon2 Hashing in Async Event Loop

**Files:** `backend/app/api/v1/endpoints/auth.py:148,235,335,341,422`  
**Also:** `backend/app/core/security.py:16-21`  

`passlib` Argon2 `hash_password()` and `verify_password()` are synchronous and CPU-intensive. Called in the async event loop during register, login, password change, and password reset. Under concurrent load, these block all other requests.

**Fix:** Wrap in `asyncio.to_thread()`:
```python
password_hash = await asyncio.to_thread(hash_password, body.password)
if not await asyncio.to_thread(verify_password, body.password, user["password_hash"]):
    ...
```

**Effort:** 1 hour  
**Risk if ignored:** Degraded throughput under concurrent auth requests; potential timeouts.

---

## High-Severity Issues

### H1. Hardcoded Default Secrets

**File:** `backend/app/core/config.py:23,27`  

```python
secret_key: str = "change-me-in-production"
email_encryption_key: str = "0123456789abcdef..."
```

The app silently accepts these defaults. A forgotten environment variable means JWTs are forgeable and emails are decryptable.

**Fix:** Remove defaults. Validate on startup that keys are set and not placeholders.

**Effort:** 30 minutes  
**Risk if ignored:** Trivial JWT forgery and email decryption in production if env vars are missed.

---

### H2. N+1 Author Queries in Public Feed

**File:** `backend/app/services/diary_service.py:380-386`  

`list_public_diaries()` fetches each author individually in a loop. For a page of 20 diaries with 20 unique authors, that's 20 sequential DB calls.

**Fix:** Batch fetch: collect all `author_id` values, do a single `$in` query.

**Effort:** 30 minutes  
**Risk if ignored:** Linear latency growth — 20ms per page becomes 400ms per page at 100 items.

---

### H3. Encrypted Data Leaked to Non-Owners

**File:** `backend/app/services/diary_service.py:57-59`  

The backend returns `encrypted_data` for private diaries based on `is_owner` check in `_build_diary_response`. However, the check only happens **after** the diary is fetched from the DB. If an attacker crafts a request with a stolen JWT for another user, they could see ciphertext bytes (even though they can't decrypt without the master key). Ciphertext length reveals approximate content length, which is metadata leakage.

**Fix:** Remove `encrypted_data` from the response entirely when `!is_owner`. The frontend should never receive ciphertext for diaries it doesn't own.

**Effort:** 15 minutes  
**Risk if ignored:** Metadata leakage about private diary sizes to unauthorized viewers.

---

### H4. Meilisearch Configured But Never Used

**Files:** `docker-compose.yml`, `backend/app/core/config.py:20-21`  

Meilisearch runs as a service consuming RAM (~500MB), has config values, but no backend code imports or uses it. Search uses MongoDB `$regex` which doesn't scale.

**Fix:** Either integrate Meilisearch for real full-text search, or remove it from docker-compose to reclaim resources.

**Effort:** 4 hours (integrate) or 15 minutes (remove)  
**Risk if ignored:** Wasted RAM; search performance degrades linearly with document count.

---

### H5. CSP Middleware Name Is Misleading

**File:** `backend/app/core/middleware.py:16-26`  

The class is named `CSPSecurityMiddleware` but does NOT set a `Content-Security-Policy` header. This is the most important header against XSS for a diary platform rendering user HTML.

**Fix:** Add actual CSP header with safe defaults for a Tiptap-based platform.

**Effort:** 1 hour  
**Risk if ignored:** No CSP defense against XSS exploits.

---

### H6. No Frontend Test Framework

**File:** `frontend/package.json` — no test scripts  

Zero frontend tests exist: no Vitest/Jest, no React Testing Library, no Playwright. The crypto module, editor encryption, and master key lifecycle are untested.

**Fix:** Install Vitest, add crypto tests (encrypt/decrypt roundtrip, wrong key, tampered data), hook tests, and E2E smoke tests with Playwright.

**Effort:** 1 day (baseline test setup + crypto tests)

---

### H7. Bleach Is Deprecated

**File:** `backend/app/core/sanitize.py:1`, `backend/pyproject.toml:17`  

`bleach` has been deprecated since 2023 with no security patches. The recommended replacement is `nh3`.

**Fix:** Migrate to `nh3`. API is similar, performance is better.

**Effort:** 1 hour  
**Risk if ignored:** No security patches for HTML sanitizer.

---

### H8. Missing Rate Limits on Sensitive Endpoints

| Endpoint | Missing Rate Limit |
|---|---|
| `POST /auth/change-password` | Yes — brute-force current password |
| `POST /auth/reset-password` | Yes — brute-force tokens |
| `PUT /users/me/encryption-key` | Yes — DoS via key storage |
| `DELETE /diaries/{diary_id}` | Yes — mass deletion |

**Fix:** Add `check_rate_limit` calls to all four endpoints.

**Effort:** 30 minutes

---

### H9. No Transactions for Multi-Collection Mutations

**Files:** `backend/app/repositories/diary_repo.py:126-133`, `backend/app/services/diary_service.py:207`  

Diary creation increments `diary_count` in a separate operation. Diary deletion cascades across 4 collections without a MongoDB session. Stats can drift under failures.

**Fix:** Use MongoDB sessions with transactions for diary create + stat update, and delete cascade.

**Effort:** 2 hours  
**Risk if ignored:** Stat inconsistencies under partial failures.

---

### H10. `_optional_user` Swallows All Exceptions

**File:** `backend/app/api/deps.py:24`  

```python
except Exception:
    pass
```

Broad exception catch hides database connection errors, config issues, and bugs. Treats all failures as "not authenticated."

**Fix:** Catch only `AuthenticationException`.

**Effort:** 5 minutes

---

### H11. No Backend Healthcheck in Docker Compose

**File:** `docker-compose.yml`  

No healthcheck on the backend service. If the backend crashes, Docker can't restart it automatically.

**Fix:** Add `healthcheck` block with `curl http://localhost:8000/api/v1/health`.

**Effort:** 10 minutes

---

### H12. Missing Explore Page Implementation

**File:** `frontend/src/app/(main)/explore/page.tsx`  

The Explore page is a static placeholder: "Results will appear here when connected to the backend." No data fetching, no search bar, no filters.

**Fix:** Implement using `useDiaries` with tag/emotion/year/month filters.

**Effort:** 3 hours

---

## Medium-Severity Issues

### M1. `_fmt_dt()` Defined 4 Times

**Files:** `auth.py:61-64`, `diary_service.py:15-20`, `user_service.py:9-12`, `users.py:23-28`  

Identical helper defined in 4 files. Move to `app/core/utils.py`.

**Effort:** 15 minutes

---

### M2. Duplicate Email Encryption Code

**File:** `auth.py:39-58` duplicates `encryption_service.py:10-25`  

`_get_email_aesgcm()` is copy-pasted. Any key format change requires editing two files.

**Fix:** Move `_decrypt_email()` to `encryption_service.py`, import all from there.

**Effort:** 20 minutes

---

### M3. Business Logic in Endpoint Files

**File:** `auth.py` — ~250 lines of business logic  
**File:** `users.py:100-154` — raw DB access  
**File:** `discover.py:9-42` — no service/repo layer  

Architecture doc specifies thin endpoints → service → repository layering. Discover endpoints bypass all layers.

**Fix:** Extract to `auth_service.py`, move user diaries logic to `diary_service.py`, create `discover_service.py`.

**Effort:** 4 hours

---

### M4. `editor-page.tsx` Is 571 Lines

The editor component handles saving, draft recovery, preview modal, key setup modal, keyboard shortcuts, and delete confirmation. Too many concerns in one file.

**Fix:** Extract modals (`KeySetupDialog`, `PreviewModal`) and save logic (`useEditorSave` hook).

**Effort:** 3 hours

---

### M5. ARIA Missing on Modals

**Files:** Password prompt, key setup, preview, warning overlay modals  

No `role="dialog"`, `aria-modal`, focus trapping, or Escape-to-close on any modal in the app.

**Fix:** Add proper ARIA attributes and keyboard handling.

**Effort:** 2 hours

---

### M6. `relativeTime()` Duplicated 3 Times

**Files:** `diary-card.tsx:34-50`, `diary-entry.tsx:17-33`, `profile/[username]/page.tsx:16-32`  

**Fix:** Extract to `lib/utils.ts`.

**Effort:** 10 minutes

---

### M7. No No-Owner Ciphertext Leak from Backend

**File:** `backend/app/services/diary_service.py:57-59`  

Already noted as H3. The backend currently returns `encrypted_data` to the owner only. The check at line 57 correctly gates this. However, the diary document includes `encrypted_data` field that the repository returns for all readers — only the response builder strips it.

**Fix:** Ensure repository `get_by_id` doesn't project `encrypted_data` for non-owner lookups, or keep the current response-level filter (acceptable for now).

---

### M8. `_oid()` in `diary_repo.py` Has No Invalid ID Guard

**File:** `backend/app/repositories/diary_repo.py:9-10`  

`ObjectId(id_str)` throws `InvalidId` on malformed input. Unlike `BaseRepository.get_by_id()` which validates.

**Fix:** Add `ObjectId.is_valid()` check before constructing.

**Effort:** 5 minutes

---

### M9. Weak Email Validation

**File:** `backend/app/services/user_service.py:96`  

Only checks `"@" in email`. Accepts `"@"`, `"a@b"`.

**Fix:** Use `email-validator` package for proper RFC-compliant validation.

**Effort:** 30 minutes

---

### M10. `masterKeyMap` Has No Cleanup

**File:** `frontend/src/hooks/use-master-key.ts:32`  

Module-level `Map<string, CryptoKey>` persists keys indefinitely. No eviction, TTL, or size limit. On logout, `clearMasterKey` must be called explicitly — other mounted components won't know the key was cleared.

**Fix:** Add an event-based cleanup or integrate with auth-store logout.

**Effort:** 1 hour

---

### M11. Password Reset Destroys Private Diaries Without Warning

**File:** `backend/app/api/v1/endpoints/auth.py:434-437`  

Sets `encrypted_master_key`, `master_key_salt`, `master_key_iv` to `None` silently. API responds "Password reset successfully" with no data-loss warning.

**Fix:** Include warning in response: `"warning": "All encrypted diaries are now inaccessible."`

**Effort:** 10 minutes

---

### M12. Rate Limiter Fails Open When Redis Is Down

**File:** `backend/app/core/security.py:58-64`  

`check_rate_limit` returns `(False, max_attempts)` on Redis connection failure, disabling rate limiting.

**Fix:** Fail closed for critical endpoints (login, register).

**Effort:** 30 minutes

---

### M13. `DiaryListItem` Pydantic Model Missing Fields

**File:** `backend/app/models/diary.py:76-89`  

Missing `privacy` and `encrypted_data` fields that are present in `_build_diary_list_item()`.

**Fix:** Add fields to model.

**Effort:** 5 minutes

---

### M14. `diary-store.ts` Is Dead Code

**File:** `frontend/src/store/diary-store.ts`  

Never imported anywhere in the codebase. Should be removed or integrated.

**Fix:** Remove or wire into diary saving flow.

**Effort:** 5 minutes

---

### M15. `diary-entry.tsx` and `diary-form.tsx` Appear Unused

**Files:** `frontend/src/components/diary/diary-entry.tsx`, `diary-form.tsx`  

No component imports these. Older non-Tiptap components that were replaced but not removed.

**Fix:** Remove dead code.

**Effort:** 5 minutes

---

## Low-Severity Issues

### L1. Missing `schema_version` Field
Architecture doc requires `schema_version: 1` on all documents. Not present anywhere.

### L2. Cookie `secure` Flag Tied to `debug` Mode
If `debug=True` leaks to production, cookies lose `Secure` flag.

### L3. Unused JWT `jti` Claim
Generated but never validated. Either implement token revocation or remove.

### L4. No Audit Log Writes
`audit_logs` collection schema exists but is never written to.

### L5. `diary_count` Stat Counts All Diaries Including Private
Architecture spec says `diary_count` should only count published diaries (`docs/database.md:162-163`).

### L6. Redundant `from datetime import datetime` in `users.py`
Duplicate import on lines 1 and 3.

### L7. Lazy Exception Imports Inside Functions
`NotFoundException` and `ValidationException` imported inside function bodies in `user_service.py` instead of at module top.

### L8. Hardcoded Values in Multiple Places
Cookie expiry, content size limits, tag length, MongoDB idle timeout — should be in config.

### L9. No `per_page` Max Enforced in `fetchMyDiaries`
Frontend passes no `per_page` to `/me/diaries` — defaults to 20. Acceptable but should be explicit.

### L10. `useEffect` Dependency Cycle in `me/page.tsx`
`decryptedTitles` in the dependency array creates a fragile cycle.

### L11. `toBuf` Function in `crypto.ts` Is Dead Code
Defined but never exported or used.

### L12. Missing `aria-label` on Floating Toolbar Buttons
Only `type="button"` set, no accessible labels.

### L13. Autocomplete Dropdown Has No ARIA Roles
`tags-autocomplete.tsx` uses plain `<div>` elements without `combobox`/`listbox` roles.

### L14. Missing `background:true` on Index Creation
Only relevant for MongoDB < 4.2. Acceptable.

### L15. No `staleTime` on `useDiaries` Infinite Query
Will refetch on every window focus.

---

## Privacy Verification

| Guarantee | Status |
|-----------|--------|
| Server never receives private diary plaintext | ✅ Verified — encryption happens in browser via Web Crypto API before API call |
| Private diary content not searchable | ✅ Verified — Meilisearch not used, MongoDB queries filter `privacy: "public"` |
| Admin cannot read private diaries | ✅ Verified — `get_diary` returns 404 for non-owners |
| Tags not encrypted (intentional trade-off per M8 spec) | ✅ Correct per spec |
| Master key never leaves client unencrypted | ✅ Verified — `encryptMasterKey` wraps with password-derived key before API call |
| Password reset destroys private diaries | ✅ Correct per design — data loss warning should be more prominent (M11) |

---

## What's Working Well

1. **Encryption implementation is cryptographically sound** — PBKDF2 600k iterations, AES-256-GCM, HKDF per-diary keys, domain-separated info strings, proper IV/salt generation.

2. **Backend test coverage is good** — 64 tests covering auth, diaries, users, and repositories. All pass.

3. **Privacy filters are correctly implemented** — private diaries excluded from public feed, random, search, and profile listings at the DB query level.

4. **Index design matches query patterns** — all public-facing queries have corresponding compound indexes.

5. **Tiptap editor integration is well-executed** — dynamic import with SSR disabled, proper loading states.

6. **TypeScript strict mode is enabled** — catches type errors at build time.

7. **Theme system is clean** — dark/light/system with no-flash prevention inline script.

---

## Prioritized Remediation Plan

### Batch 1: Critical Security (4 items, ~5 hours)

| ID | Item |
|---|---|
| C1 | Sanitize HTML in `dangerouslySetInnerHTML` |
| C2 | Add admin auth guard |
| C4 | Wrap Argon2 hashing in `asyncio.to_thread()` |

### Batch 2: Production Hardening (6 items, ~4 hours)

| ID | Item |
|---|---|
| H1 | Remove hardcoded default secrets |
| H5 | Add actual CSP header |
| H8 | Add rate limits to missing endpoints |
| H10 | Fix `_optional_user` exception swallowing |
| H11 | Add backend healthcheck to docker-compose |
| H2 | Fix N+1 author queries |

### Batch 3: Data Integrity (2 items, ~2 hours)

| ID | Item |
|---|---|
| H9 | Add transactions for multi-collection mutations |
| M8 | Add invalid ID guard to `_oid()` |

### Batch 4: Encryption & Privacy Polish (4 items, ~4 hours)

| ID | Item |
|---|---|
| H3 | Strip `encrypted_data` from non-owner responses |
| C3 | Add encryption key management tests |
| M11 | Add data-loss warning to password reset |
| M10 | Add master key cleanup on logout |

### Batch 5: Code Quality & Maintainability (6 items, ~3 hours)

| ID | Item |
|---|---|
| M1 | Extract `_fmt_dt()` to shared utility |
| M2 | Consolidate email encryption code |
| M6 | Extract `relativeTime()` to shared utility |
| M13 | Fix `DiaryListItem` model |
| M14 | Remove dead `diary-store.ts` |
| M15 | Remove dead `diary-entry.tsx`, `diary-form.tsx` |

### Batch 6: Technical Debt (4 items, ~5 hours)

| ID | Item |
|---|---|
| M3 | Extract business logic from endpoints to services |
| M4 | Split `editor-page.tsx` |
| M5 | Add ARIA to modals |
| H6 | Add frontend test framework |

---

## Go / No-Go Recommendation

**❌ NO-GO for Milestone 09.**

The 4 critical issues (C1–C4) must be resolved first:
- C1 (XSS) and C2 (admin auth) are security risks
- C3 (no encryption key tests) risks data loss
- C4 (blocking hashing) risks production outages under load

After Batches 1–4 are completed (approximately 15 hours of work), the codebase will be production-ready and safe to begin M09 (Social Features).

The architecture is sound. The implementation is solid. The missing pieces are security hardening, test coverage, and code organization — not design flaws.
