# Session — M09 Social Features + Discussion System

**Date:** June 28, 2026  
**Branch:** `feat/milestone-08-private-diaries`  
**Tests:** 95/95 pass

---

## Milestone 09 — Social Features

### Backend (14 new files)
- `backend/app/repositories/comment_repo.py` — Comment CRUD with threading, reply counts, like counts
- `backend/app/repositories/like_repo.py` — Like toggle, batch lookup
- `backend/app/repositories/bookmark_repo.py` — Bookmark toggle, batch lookup
- `backend/app/repositories/follow_repo.py` — Follow/unfollow, list followers/following
- `backend/app/services/comment_service.py` — Create/list/delete with threading, depth tracking
- `backend/app/services/social_service.py` — Like/bookmark/follow toggle, list endpoints
- `backend/app/services/enrichment_service.py` — Batch is_liked/is_bookmarked enrichment
- `backend/app/api/v1/endpoints/comments.py` — CRUD + replies + comment likes
- `backend/app/api/v1/endpoints/social.py` — Like/bookmark/follow + lists
- `backend/app/models/comment.py` — CommentCreate, CommentResponse with thread fields
- `backend/app/models/social.py` — ToggleResponse, UserListItem
- `backend/app/schemas/comment.py` — Updated with threading + comment_likes indexes
- `backend/tests/test_api/test_social.py` — 25 tests (comments, likes, bookmarks, follows, threads, comment likes)

### Frontend (7 new files)
- `frontend/src/hooks/use-social.ts` — 14 TanStack Query hooks
- `frontend/src/components/social/comment-section.tsx` — Full comment list with input
- `frontend/src/components/social/comment-item.tsx` — Threaded reply display with context
- `frontend/src/components/social/like-button.tsx` — Heart toggle with optimistic UI
- `frontend/src/components/social/bookmark-button.tsx` — Bookmark toggle
- `frontend/src/components/social/follow-button.tsx` — Follow/unfollow with hover pattern
- Updated pages: diary reader, profile, my likes, my bookmarks

---

## Threaded Discussion System

### Architecture
- Flat data model: `parent_comment_id`, `root_comment_id`, `depth`, `reply_count`, `like_count`
- New `comment_likes` collection with unique compound index
- Unlimited DB nesting, enforced depth cap at 4

### UX Design
- Single-level visual indent (20px) with vertical thread line
- "Replying to @user: excerpt..." context label on every reply
- "View N replies" lazy expansion
- Optimistic delete (comment disappears immediately)
- Optimistic like toggle with error rollback

---

## Technical Debt Sprint

- Removed hardcoded default secrets (SECRET_KEY, EMAIL_ENCRYPTION_KEY)
- Pydantic validators fail fast on missing/insecure values
- Fixed frontend Dockerfile (package-lock.json for npm ci)
- Removed 4 dead npm packages + 8 dead source files
- Fixed `_optional_user` exception swallowing
- Consolidated email encryption (removed duplication in auth.py)
- Extracted `fmt_dt` to shared utility, `relativeTime` to shared utility
- Synced requirements.txt with pyproject.toml

---

## Final Audit Findings (Resolved)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Comment like on private diary comments | Added diary privacy check |
| 2 | Missing rate limit on comment likes | Added 30/min |
| 3 | MAX_DEPTH declared but never enforced | Added validation |
| 4 | enrichment dead code — no like state on lists | Wired into all list endpoints |
| 5 | Comment count stale after deletes | Batch aggregation + count sync |
| 6 | Reply count not decremented on delete | Added $inc -1 on parent |
| 7 | Deleted comments still counted | Filter is_deleted from queries |

---

## Verification
- 95/95 backend tests pass
- TypeScript typecheck passes
- ESLint clean (pre-existing warnings only)
- READY FOR MILESTONE 10
