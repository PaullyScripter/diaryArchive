# DiaryArchive - Enterprise Production Readiness & Security Audit

- Date: 2026-08-14
- Scope: full-stack (FastAPI + MongoDB + Redis + MinIO + Meilisearch backend, Next.js/React frontend, Docker/Nginx infra)
- Branch: `chore/footer-tagline` (all findings apply to current HEAD)

## Executive Summary

The application has a strong security posture. Password hashing uses Argon2
(passlib), refresh tokens are hashed at rest and rotated on use, emails are
encrypted with AES-GCM and a keyed hash is used for lookups, admin status is
authoritative from the DB (not the JWT), media is re-encoded (EXIF stripped)
with magic-byte validation, object ownership is validated server-side in the
core flows, and a server-side content sanitizer guards diary HTML/XSS.

However, several verified issues block a clean SHIP, all centered on
**rate-limit keying and unauthenticated credential-verification surface**:

1. `get_client_ip` trusts the client-supplied `X-Forwarded-For` header, and the
   nginx config appends rather than overwrites it. Every per-IP rate limit is
   spoofable (turns auth brute-force protection into a no-op).
2. Three unauthenticated `/auth/appeal*` endpoints re-verify passwords with no
   account lockout; `/auth/appeal/status` is keyed by IP only, making it a
   password oracle for every account.
3. `/tickets/{id}/reply` has no rate limit and accepts empty messages.
4. Media URLs for non-private assets are built from the internal MinIO host
   (`http://minio:9000`), which browsers cannot resolve in production.

Remediation of these is straightforward and low-risk (addressing them in P0-P2
order below). No catastrophic (data-loss/privilege-escalation) defects were
found. **Recommendation: SHIP on the condition that the P0/P1 findings are
fixed and their regression tests added.**

## 1. Architecture Overview

Monorepo: `backend/` (FastAPI, Motor async MongoDB, Redis rate limiting,
MinIO media, Meilisearch), `frontend/` (Next.js App Router, Zustand, axios),
`docker/` (nginx + prod compose). Auth: access JWT (15-min) + hashed rotating
refresh token (7-day) in HTTP-only cookie. Server-side sanitizer for diary HTML.

## 2. Verified Non-Issues (investigated, confirmed safe)

- Password hashing: Argon2 via passlib (`verify_password_async`).
- Admin authorization: `get_current_admin` re-reads DB doc - demotions effective
  immediately; access-token `is_admin` is advisory only.
- No mass assignment to `is_admin`/`email`: `UserUpdate` whitelist enforced.
- Refresh token revocation on ban; all sessions invalidated.
- Media pipeline: magic-byte detect, WebP re-encode (EXIF stripped), 50MB cap,
  per-user/daily quotas.
- Sanitizer: allowlist tags/attrs/CSS, value blocklist, linkify - 15/15 survival,
  14/14 forbidden-clean in probes.
- Comments/notifications/likes ownership validated (no IDOR found).

## 3. Verified Findings

### SEV-001 / SEC-001 - Spoofable client IP defeats rate limiting (High, LIKELY)
- **File:** `backend/app/core/security.py:97-104` (`get_client_ip`); `docker/nginx/nginx.conf:69,78,87,95`
- `get_client_ip` returns the first `X-Forwarded-For` value. nginx uses
  `$proxy_add_x_forwarded_for` (appends) not overwrite, so a client-provided
  first entry is trusted. All per-IP rate-limit keys become attacker-rotatable.
- **Impact:** brute-force / credential-stuffing protection is a no-op; compounds SEV-002.
- **Fix:** nginx overwrite `X-Forwarded-For $remote_addr`; backend read a trusted
  header (`X-Real-IP`) set by the proxy, never the raw client header, for security keys.

### SEV-002 - Unauthenticated password-verification endpoints (High, HIGH)
- **File:** `backend/app/api/v1/endpoints/appeals.py:35-78`, `81-125`, `128-180`
- `/auth/appeal/status`, `/auth/appeal/reply`, `/auth/appeal` accept
  `username`+`password` and run `verify_password_async` with no auth and no
  lockout. `appeal/status` rate limit keys IP only -> password oracle for any account.
- **Impact:** triples brute-force surface; info disclosure of ban/appeal/admin data.
- **Fix:** per-account exponential lockout; per-username+per-IP limits counting
  failures; key `appeal/status` by username+IP, not IP alone.

### SEV-003 - Unbounded collection scan on my likes/bookmarks (Medium, HIGH)
- **File:** `backend/app/services/social_service.py:336-339`, `399-402` (`to_list(length=10000)`)
- **Fix:** count via `count_documents({"user_id": ...})`, avoid full materialization.

### SEV-004 - Non-atomic like/bookmark/follow read-modify-write (Medium, MEDIUM)
- **File:** `backend/app/services/social_service.py:49-77`, `113-141`, `179-202`
- **Fix:** atomic `find_one_and_update` guarded by unique `(user_id, target)` index.

### SEV-005 - No rate limit / empty-message guard on user ticket reply (Medium, HIGH)
- **File:** `backend/app/api/v1/endpoints/tickets.py:73-86`; `backend/app/models/ticket.py:22`
- **Fix:** add rate limit mirroring creation; enforce `min_length>=1` and strip.

### SEV-006 - Unauthenticated search health discloses internals (Low, HIGH)
- **File:** `backend/app/api/v1/endpoints/search.py:75-94`
- **Fix:** require auth/admin or remove index/doc internals; add rate limit.

### SEV-007 - Account-state enumeration via error divergence (Low, HIGH)
- **File:** `backend/app/services/user_service.py:35-40`; `endpoints/users.py:24-30`
- Nonexistent -> 404, banned -> 403. **Fix:** unify body for both.

### SEV-008 - Unbounded pagination on admin warnings (Low, HIGH)
- **File:** `backend/app/api/v1/endpoints/warnings.py:192-207`
- **Fix:** `page ge=1`, `per_page ge=1 le=100`.

### SEV-009 - Duplicate achievement evaluation (Info)
- **File:** `backend/app/services/social_service.py:90-91`
- **Fix:** remove duplicate background call.

### PRI-001 - Media URLs use internal MinIO host (High, HIGH)
- **File:** `backend/app/services/media_service.py:106,114,123`; `config.py:15`
- Public (non-private) media builds `url` from `settings.minio_endpoint`
  (`http://minio:9000`) - not resolvable from browser in prod.
- **Fix:** introduce a public media base URL setting / nginx route for MinIO;
  always serve private media via short-lived signed URLs.

### PRIV-001 - Unsalted email hash (Medium, MEDIUM)
- **File:** `backend/app/services/encryption_service.py:32` (`hash_email` = raw SHA256)
- **Fix:** HMAC-SHA256 with a server-side keyed secret.

### CONF-001 - Hardcoded DB name (Low, MEDIUM)
- **File:** `backend/app/core/database.py` (`get_db` hardcodes `.diaryarchive`)
- **Fix:** derive DB name from `MONGODB_URI`, allow override.

### SEC-003 - Sanitizer permits `position:fixed` + `z-index` (Medium, documented tradeoff)
- **File:** `backend/app/core/sanitize.py`
- CSS UI-redressing risk; accepted per product requirement "no features omitted".
- **Recommended:** keep, but restrict to max `z-index` and forbid `position:fixed`
  unless content is sandboxed (iframed) - flag for product decision.

### CSP-001 - Frontend CSP uses `unsafe-inline` (Medium/Low, HIGH)
- **File:** `docker/nginx/nginx.conf:106`
- `script-src 'self' 'unsafe-inline'` needed for Next.js hydration; weaker than
  ideal. Recommend nonce-based inline script policy (Next.js `nonce`) and
  `strict-dynamic` where feasible. Backend API CSP (`middleware.py`) is strict
  but only applies to API responses; note the implicit `connect-src`/`img-src`
  allowlist of internal MinIO hosts there too.

### OPS-001 - `backend/.env.development` committed with dev credentials (Low, MEDIUM)
- Dev-only secrets with `DEBUG=true` guard; prod compose fails on weak values.
- **Fix (hygiene):** confirm no prod credentials ever land in this file; the
  current values are dev-only and guarded. Track `backend/.env.*.local` strictly.

## 4. Recommendation

**SHIP conditional on fixing P0/P1** (SEV-001, SEV-002, PRI-001, SEV-005) and
adding regression tests. P2/P3 (SEV-003, SEV-004, SEV-006, SEV-007, SEV-008,
SEV-009, PRIV-001, CONF-001) should be fixed in the same hardening pass. SEC-003
is a documented product tradeoff; CSP-001 recommended follow-up.

## 5. Remediation Status

All P0/P1/P2/P3 findings above have been remediated and covered by regression
tests (`backend/tests/test_security_hardening.py`). Backend suite: 242 passed.

- **SEV-001** FIXED: `get_client_ip` prefers trusted `X-Real-IP` and uses the
  rightmost `X-Forwarded-For` value; nginx now overwrites `X-Forwarded-For $remote_addr`.
- **SEV-002** FIXED: shared `_verify_credentials` helper adds per-account lockout
  (`appeal_*_lockout` limits) and keys rate limits by username+IP (no more IP-only oracle).
- **PRI-001** FIXED: new `public_media_base_url` setting; when unset, public media
  uses short-lived signed URLs instead of leaking the internal MinIO host.
- **SEV-005** FIXED: `TicketReply.message` requires `min_length=1`; user reply is rate limited.
- **SEV-003** FIXED: my likes/bookmarks counts use a DB-side aggregation, no `to_list(10000)`.
- **SEV-004** NO CODE CHANGE NEEDED: already mitigated by the existing unique
  indexes on `(diary_id, user_id)` / `(follower_id, following_id)`.
- **SEV-006** FIXED: `/search/health` is admin-only and no longer exposes index
  name/document counts.
- **SEV-007** FIXED: banned and nonexistent users both return 404.
- **SEV-008** FIXED: admin warnings pagination bounded (`page>=1`, `per_page 1..100`).
- **SEV-009** FIXED: duplicate achievement evaluation removed.
- **PRIV-001** FIXED: `hash_email` is now versioned HMAC-SHA256 (`v2:` prefix);
  legacy raw-SHA256 values still resolve via `legacy_email_hash`/`matches_email_hash`.
- **CONF-001** FIXED: `get_db()` derives the DB name from `MONGODB_URI`.

Also fixed an existing bug in the in-process rate-limit fallback
(`_fallback_consume`), which previously pruned its key on essentially every call
and so never actually limited when Redis was down.