# Moderation hardening audit

## Request

Resolve the identified moderation-system problems across warnings, bans,
reports, tickets, appeals, notifications, and moderation background jobs.

## Findings

The audit covered the complete moderation flow rather than only the warning
deadline change. It identified authorization gaps, stale moderation state,
race conditions, inconsistent ban/cache/search handling, report-evidence loss,
over-broad report targets, weak request validation, and missing abuse controls.

## Changes

- Enforced bio-edit suspensions and made username-warning completion a real,
  server-validated username update flow.
- Made warning issuance rate-limited and bio-warning increments atomic; made
  warning workers claim work safely across instances and process without a
  fixed 1,000-user cap.
- Unified automatic and manual ban cleanup: refresh-token revocation, banned
  user cache refresh, search removal, audit records, and user notifications.
- Preserved reports and tickets as moderation evidence when diaries or accounts
  are removed; made report resolution and ticket assignment race-safe.
- Restricted reports to valid public, non-self targets, deduplicated bug
  reports, and rejected deleted comments.
- Enforced ticket assignment and real appeal eligibility/authorization, and
  corrected appeal lockout-window enforcement.
- Added strict, bounded ban request validation, consistent audit IP handling,
  banned-user diary count filtering, and frontend support for ban notices.

## Verification

- `python -m pytest -q` — 320 passed, 8 existing deprecation/environment warnings.
- `python -m compileall -q backend/app` — passed.
- `python -m ruff check backend/app backend/tests/test_api/test_warnings.py` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed; Next.js reported its existing `next lint`
  deprecation notice.
- `git diff --check` — passed.

## Git

Pending commit and push on the `moderation-hardening` branch.

## Follow-up

The existing warning-worker and notification tests should be expanded further
if the project later adds a dedicated integration-test database fixture for
multi-instance scheduling behavior.
