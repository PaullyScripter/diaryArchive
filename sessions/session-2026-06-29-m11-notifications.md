# Session — M11 Notifications + Production Hardening

**Date:** June 29, 2026
**Branch:** `fix/add-meilisearch-to-infra`
**Tests:** 123/123 pass

---

## Milestone 11 — Notifications Implementation

### Backend (5 new files)
- `backend/app/models/notification.py` — NotificationResponse Pydantic model
- `backend/app/repositories/notification_repo.py` — CRUD, count, mark_read, mark_all_read
- `backend/app/services/notification_service.py` — Fire-and-forget creation with preference checks, self-filter, message building
- `backend/app/api/v1/endpoints/notifications.py` — 4 endpoints (list, unread-count, mark-read, mark-all-read) with rate limits
- `backend/tests/test_api/test_notifications.py` — 8 unit tests

### Frontend (5 new files)
- `frontend/src/hooks/use-notifications.ts` — TanStack Query with 60s polling, auth gating, cache invalidation
- `frontend/src/app/(main)/notifications/page.tsx` — Notification center with date-grouped list, mark-all-read, empty/loading/error states
- `frontend/src/components/notifications/notification-item.tsx` — Single notification row with type icon, message, click-to-navigate + mark-read
- `frontend/src/components/notifications/notification-list.tsx` — Date-grouped list container (Today/Yesterday/This Week/This Month/Earlier)
- `frontend/src/components/notifications/notification-bell.tsx` — NavBar bell icon with unread badge, dropdown (5 recent + View all)

### Modified Files (7 files)
- `backend/app/api/v1/router.py` — Registered notifications router
- `backend/app/services/social_service.py` — Notification hooks in toggle_like, toggle_bookmark, toggle_follow
- `backend/app/services/comment_service.py` — Notification hooks for diary owner + parent comment author
- `backend/app/services/notification_service.py` — actor_avatar_path storage, target_type fix, reply excerpt in messages
- `frontend/src/components/layout/navbar.tsx` — Bell integration, notification link in user menu
- `frontend/src/app/(main)/diary/[id]/page.tsx` — Scroll-to-comment highlight with auto-expand, hashchange listener
- `frontend/src/app/(main)/settings/page.tsx` — Real notification preference toggle switches

### Supporting Files
- `frontend/src/components/shared/toast.tsx` — Toast system with aria-live for 429 rate limit feedback
- `frontend/src/components/shared/icons.tsx` — Added BellIcon SVG
- `frontend/src/app/globals.css` — Comment highlight flash animation
- `frontend/src/lib/api/client.ts` — 429 toast integration

---

## Production Hardening (Post-Audit Fixes)

### Critical
- Escape key dismisses bell dropdown (keyboard accessibility)
- Toast announced to screen readers (aria-live)
- Semantic HTML: removed `role="button"` from `<Link>`

### High
- `actor_avatar_path` stored in notification documents
- Date groups ordered deterministically (Today → Yesterday → ... → Earlier)
- Memory leak fixed: timer cleanup on diary page unmount
- "View replies" button clicking scoped to comments container only
- `markAllRead` error feedback: inline error message
- `target_type` respects caller-supplied value (diary vs comment)

### Medium
- Query invalidation covers both `["notifications"]` and `["notifications", "unread-count"]`
- `staleTime: 55s` + `refetchIntervalInBackground: false` to reduce unnecessary requests
- Comment reply excerpt now included in reply notification messages
- `metadata` field added to NotificationResponse model

---

## Acceptance Criteria — All PASS

1. Like creates notification ✓
2. Comment creates notification ✓
3. Follow creates notification ✓
4. Bookmark creates notification ✓
5. Self-action filtered ✓
6. Preferences respected ✓
7. /notifications paginated, unread-first ✓
8. /notifications/unread-count fast endpoint ✓
9. Click marks read + navigates ✓
10. Mark all as read ✓
11. NavBar bell with badge ✓
12. Bell dropdown 5 recent + View all ✓
13. 90-day TTL ✓
14. Users only see own ✓
15. Empty state ✓
16. Polling (60s) ✓
17. All tests pass ✓

---

## Final Scores

| Dimension | Score |
|-----------|:-----:|
| Overall Engineering Quality | 8 |
| Production Readiness | 8 |
| Security | 8 |
| Scalability | 7 |
| Performance | 7 |
| UX | 7.5 |
| Accessibility | 7 |
| Maintainability | 7.5 |

**Verdict:** Production Ready with Minor Improvements
