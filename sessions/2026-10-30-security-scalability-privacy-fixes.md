# 2026-10-30 — security, scalability, UX, and privacy fixes

## Request

Implement the actionable security, scalability, UX, and privacy improvements
identified by the repository-wide DiaryArchive audit, including the media
disappearing-after-load path.

## Findings

The audit confirmed several cross-layer risks: mutable media URLs could outlive
authorization changes, synchronous account exports and deletion paths could
retain too much state or fail partially, refresh rotation lacked family reuse
detection, search rebuilds could clear the live index before a failed rebuild,
and feed/cache, CSS, pagination, and social retry behavior needed hardening.

## Changes

- Added strict JWT claims/bearer parsing, refresh-token family reuse detection,
  bounded auth inputs, production configuration checks, Mongo timeouts, and
  fail-closed authentication lockout behavior.
- Made media references authorization-aware and no-store, added ETag/range
  support, bounded avatar/media requests, preserved metadata on failed object
  deletion, and fixed authenticated browser media hydration.
- Replaced inline account export responses with password-confirmed leased jobs,
  bounded MinIO archives, owner-only status/download endpoints, expiry cleanup,
  and deletion-time export cancellation.
- Added authenticated backup MAC sidecars, safer deployment checkout/migration
  ordering, `readWrite`-only Mongo app-user reconciliation, accurate monitoring
  rules, and removed the dead Nginx Prometheus target.
- Added temporary-index search rebuild publication, retry-visible index errors,
  hashed/versioned feed caching, idempotent social/comment state routes, bounded
  cleanup/pagination, and consistent client/server CSS hardening.
- Synchronized API/security documentation, `AGENTS.md`, and
  `PROJECT_CONTEXT.md`.

## Verification

- Backend: `python -m pytest -q` — 323 passed.
- Frontend: `npm test` — 87 passed.
- Frontend: `npm run typecheck` and `npm run lint` — passed.
- Backend: `python -m ruff check .` — passed.
- `git diff --check` — passed.
- `ruff format --check .` still reports legacy formatting drift in untouched
  files; no repository-wide formatter rewrite was applied.
- Bash syntax validation could not run because Bash is unavailable in the
  Windows environment.

## Git

Implementation commit is recorded in the repository history after validation.
The changes were not pushed because this prompt did not explicitly authorize
publishing to GitHub.

## Follow-up

Operational deployment should run the migration stage and backup verification
in the production-like environment. The remaining formatter drift and the
longer-term migration from OpenSSL CBC/HMAC envelopes to managed AEAD should
be handled as separate operational work.
