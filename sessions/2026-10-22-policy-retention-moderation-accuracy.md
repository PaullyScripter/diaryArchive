# 2026-10-22 Policy retention and moderation accuracy

## Request

Review the current Privacy Policy and Terms against recent moderation, security,
account deletion, media, and comment/notification changes, then update any
inaccurate or missing policy language.

## Findings

- The Privacy Policy incorrectly described private media as using 15-minute
  signed URLs; the current diary media flow uses stable application references
  with authenticated access checks for private media.
- Retention language still described 90-day notifications and one-year audit
  logs. Current moderation reports, tickets, appeals, and audit history are
  retained as permanent history, while notifications are removed with an
  account or through orphan cleanup.
- Account deletion preserves moderation/support records for moderation and legal
  integrity; the prior policy incorrectly called retained audit logs anonymized.
- Public Advanced Editor diaries can include external HTTPS images, so a
  reader's browser may contact an external host. Private diaries block those
  external images.
- Moderation documentation omitted the 5-day bio warning deadline, 15-day
  username warning deadline, Account Standing visibility, restricted standing
  access for banned users, appeal expectations, permanent moderation history,
  and comment deletion roles.

## Changes

- Updated `frontend/src/app/(main)/policy/page.tsx` with current media behavior,
  retention categories, deletion consequences, external-image privacy notice,
  moderation deadlines/appeal/account-standing behavior, and permanent-history
  language.
- Updated `frontend/src/app/(main)/policy/terms/page.tsx` with aligned
  moderation categories, warning deadlines, appeal expectations, comment
  deletion roles, and account-deletion retention language.
- Updated both policy dates to October 22, 2026.

## Verification

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings or errors; Next.js reported its existing
  deprecation notice for `next lint`.
- `npm test -- --run` passed: 9 test files and 83 tests.
- `git diff --check` passed.

## Git

- Branch: `policy-retention-moderation-accuracy`.
- Commit and push are completed after validation.

## Follow-up

- Policy text is product documentation, not legal advice. Recheck the final
  wording with the project operator or counsel before production publication.
