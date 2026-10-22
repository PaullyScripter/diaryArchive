# Comment deletion and notification navigation

- Request: Confirm self-comment deletion, allow diary owners to remove comments on their diaries, and fix notification navigation for deep comment threads.
- Findings: Diary-owner authorization was already enforced by the backend and comment response flags. The notification flow only loaded the first comment page and relied on DOM retries, so comments or replies beyond the initial page could be missed.
- Changes: Added an accessible destructive confirmation for author/diary-owner deletion; retained the existing admin reason dialog. Added `highlight_id` comment/reply queries that calculate the target page server-side, and initialize the diary hash state early so the targeted page is requested immediately.
- Verification: Comment/social backend tests: 36 passed. Frontend typecheck passed, ESLint passed with no warnings/errors, and Vitest passed 83 tests.
- Git: Changes are prepared on `comment-delete-and-notification-navigation`; commit and push remain to be completed after final review.
- Follow-up: Add an end-to-end browser test with a comment beyond page one and a deep reply thread.
