# Moderation warning deadlines — 2026-10-21

## Request

Change bio warning deadlines to five days and username warning deadlines to
fifteen days.

## Findings

Both deadlines were hard-coded in the moderation warning endpoint. The hourly
background checker already processes stored deadlines generically.

## Changes

- Bio warnings now expire after five days.
- Username warnings now expire after fifteen days.
- Updated user-facing notification text.
- Added API documentation and regression tests for both durations.

## Verification

- `python -m pytest -q backend/tests/test_api/test_warnings.py` — 9 passed.
- `python -m ruff check backend/app/api/v1/endpoints/warnings.py backend/tests/test_api/test_warnings.py` — passed.
- `git diff --check` — passed.

## Git

Commit `9cf5f59` (`fix moderation warning deadlines`) was pushed to the
`moderation-warning-deadlines` branch.

## Follow-up

No remaining implementation work identified.
