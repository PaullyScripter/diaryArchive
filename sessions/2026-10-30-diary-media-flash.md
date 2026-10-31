# Diary media flash fix — 2026-10-30

## Request

Investigate a diary image that appears briefly and then disappears when the
entry is opened later.

## Findings

The reader fetches uploaded media through the authenticated API and replaces
the image source with a browser `blob:` object URL. DOMPurify and the reader's
image-source policy both rejected that transient URL, so the initial stable
image was removed on the next render. This affected hydrated uploaded images,
including private-media loading paths.

## Changes

- Updated `frontend/src/lib/sanitize.ts` to retain app-created HTTP(S)-backed
  blob image URLs in both DOMPurify and the application source policy.
- Added a regression test in `frontend/src/tests/sanitize.test.ts`.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test -- --run` — passed: 87 tests.

## Git

Commit `d50dbaf` (`fix: preserve hydrated diary media images`) was created.
Push was not completed because the environment requires explicit approval for
exporting repository contents to the configured `origin` remote.

## Follow-up

Verify the affected diary in the deployed reader after the frontend release;
no diary content or media data was changed by this fix.
