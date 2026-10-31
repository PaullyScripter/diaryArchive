# Security, scalability, UX, and privacy audit — 2026-10-30

## Request

Review the current repository state and identify changes needed to improve
security, scalability, user experience, and privacy.

## Findings

- The strongest remaining risks are unauthenticated CBC backups, direct public
  media URLs that are difficult to revoke after visibility changes, and
  best-effort account deletion that can leave object-store or database data
  behind.
- Account export is still an inline, memory-heavy response and account
  deletion is synchronous; both need durable, resumable workflows with recent
  reauthentication and auditable completion state.
- Authentication and request boundaries need stricter schemas, bounded input,
  cookie-only logout, refresh-token reuse detection, and production config
  validation. Proxy/IP normalization also needs to match the real edge.
- In-process maintenance, metrics, fallback rate limiting, counter cleanup,
  deep pagination, random sampling, and media buffering limit horizontal
  scaling and can create memory or latency spikes.
- External-image tracking, author CSS/UI redress, private-query cache clearing,
  draft recovery, upload failure recovery, and screen-reader/mobile coverage
  remain important privacy and UX gaps.
- Deployment/CI drift includes incorrect deployment metadata timing, deferred
  migrations, an unavailable `requirements-dev.txt` reference, broad MongoDB
  application privileges, unpinned actions, and missing production-like
  replica-set/e2e/security validation.

## Changes

No application behavior was changed. The required synchronization lines in
`AGENTS.md` and `PROJECT_CONTEXT.md` were updated, and this summary records
the audit findings without secrets, private diary content, or unredacted logs.

## Verification

- `backend`: `python -m pytest -q` — 323 passed; 8 warnings.
- `frontend`: `npm run typecheck` — passed; `npm run lint` — passed;
  `npm test -- --run` — 87 passed.
- `backend`: `ruff check .` and `ruff format --check .` could not run because
  `ruff` is not installed in the local environment.
- Docker, MongoDB, Redis, MinIO, and production deployment behavior were
  inspected statically; no secrets or real environment files were read.

## Git

The audit documentation changes are to be committed on the current branch.
They are not pushed without explicit authorization to publish the branch.

## Follow-up

Prioritize backup AEAD and restore drills, durable export/deletion jobs,
revocable media delivery, bounded auth/API schemas, migration/deployment
correctness, and production-like load/accessibility/security testing before
adding more product surface.
