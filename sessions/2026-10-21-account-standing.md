# Account standing page

## Request

Create an Account Standing page showing the user's current status, warnings,
appeals, past appeal tickets, and related moderation history. State clearly
that historical records remain permanently and that no removal date is
promised.

## Findings

Warnings and ban actions are recorded in audit logs, while appeals and support
history are stored as user-owned tickets. The page can therefore present these
authoritative records without exposing moderator IP addresses or unrelated
accounts.

## Changes

- Added authenticated `GET /api/v1/users/me/account-standing`.
- Added `/account-standing` with current standing, active warnings, warning and
  ban history, appeals, all tickets, and permanent-history policy language.
- Added Account Standing to the authenticated user menu.
- Documented the endpoint and clarified report-evidence retention in the API
  documentation.
- Added a regression test covering warning history, appeal classification, and
  the permanent-history policy.

## Verification

- `python -m pytest -q tests/test_api/test_warnings.py` — 10 passed.
- `python -m pytest -q` — 321 passed, 8 existing warnings.
- `python -m ruff check app` — passed.
- `python -m compileall -q backend/app` — passed.
- Frontend `npm run typecheck` — passed.
- Frontend `npm run lint` — passed; existing `next lint` deprecation notice.
- `git diff --check` — passed.

## Git

Pending commit and push on `moderation-hardening`.

## Follow-up

If moderation policy later changes, update both the endpoint's policy message
and the page copy together so the user-facing promise remains consistent.
