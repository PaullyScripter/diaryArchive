# DiaryArchive — canonical project context

**Purpose:** durable, checked-in context for future Codex chats and human
contributors.

**Last reconciled:** 2026-10-21

**Last prompt synchronization:** 2026-10-28 — Strengthened the selected
network state with an accent border, highlight, ring, and shadow instead of a
selection dot; see the session summary.

**Repository:** `PaullyScripter/diaryArchive`

**Working branch at reconciliation:** `chore/footer-tagline`

This is a high-signal map, not a substitute for reading affected source and
tests. Historical plans can be stale; verify important claims against the
current tree.

## 0. Current hardening baseline

The security/scalability hardening branch makes moderation history retention
explicit, adds bounded Account Standing history pagination, requires password
confirmation for account deletion, rate-limits account export, uses atomic
Redis limiting with fail-closed behavior for security-critical outages, and
removes obsolete moderation-history TTL indexes. Large deletion paths use
cursor-based cleanup; deployment configuration requires the public application
origin and the active repository CI workflow owns automatic deployment.

The 2026-10-28 hardening pass keeps private metadata inside encrypted payloads,
validates and bounds encrypted key material, uses Redis-backed token-revocation
caching and leased maintenance/outbox work, bounds uploads/exports/pagination,
removes plaintext browser draft persistence, serves mutable media as no-store,
and enables production MongoDB authentication with a dedicated application
user. Production search rebuilds are explicit rather than automatic startup
work.

## 1. Product identity

DiaryArchive is a privacy-first diary and community application. Users can keep
entries private or publish public entries for discovery and interaction. The
product is built around the distinction between private thoughts and public
community content.

Core product areas:

- account registration, login, token refresh/logout, password changes, reset,
  and email verification;
- public profiles with biography fields, statistics, avatar/profile pictures,
  and a user's public diaries;
- diary creation, editing, drafts, publishing, deletion, privacy controls,
  tags, emotions, rich formatting, and media embedding;
- browser-side end-to-end encryption for private diary title/content/tags;
- public-diary comments, likes, bookmarks, follows, notifications, and feeds;
- full-text discovery/search for eligible public diaries through Meilisearch;
- achievements and badges, including the Bug Catcher badge;
- a static pseudonymous donation page with copyable BTC, ETH, LTC, Ethereum
  USDC, and Ethereum USDT addresses; it collects no donor information, does
  not custody funds, and intentionally omits XMR for now;
- reports, support tickets, appeals, warnings, bans, audit logs, roles, admin
  statistics, and health views;
- production-oriented deployment, rate limiting, caching, monitoring, backup,
  and restore procedures.

The repository is a monorepo. The frontend and backend are separate packages,
but diary content, authentication, media identifiers, and privacy rules cross
that boundary and must be changed consistently.

## 2. Repository layout

- `AGENTS.md`: project instructions loaded for new Codex sessions.
- `PROJECT_CONTEXT.md`: this durable project brief.
- `.codex/config.toml`: project-local Codex guidance budget/discovery settings.
- `backend/`: FastAPI/Python service.
  - `app/api/`: v1 routers and dependencies.
  - `app/core/`: config, security, database, cache, sanitization, media rules.
  - `app/models/`, `app/schemas/`: persistence and Pydantic shapes.
  - `app/repositories/`: MongoDB data-access layer.
  - `app/services/`: business logic and cross-collection flows.
  - `app/search/`: Meilisearch setup, indexing, enrichment, and sync.
  - `app/tasks/`: background and maintenance work.
  - `tests/`: pytest API/repository/service tests.
- `frontend/`: Next.js/React client.
  - `src/app/`: App Router route groups and pages.
  - `src/components/`: UI, layout, editor, media, social, and admin pieces.
  - `src/hooks/`: TanStack Query and client hooks.
  - `src/lib/`: API, crypto, sanitization, preview, and media utilities.
  - `src/store/`: Zustand state.
  - `src/tests/`: Vitest/Testing Library tests.
- `docs/`: durable technical/product documentation.
- `docs/milestones/`: milestone plans and validation reports.
- `sessions/`: versioned work summaries, not raw chat transcripts.
- `docker/`: Nginx, infrastructure, monitoring, backup/restore, deployment.
- `scripts/`: PowerShell development/test scripts and load-test helpers.
- `docker-compose*.yml`: base, local infrastructure, production, and
  monitoring definitions.
- `.github/`: CI/CD workflows and repository automation.

Important frontend route families include `/diary/new`, `/diary/[id]`,
`/diary/[id]/edit`, `/explore`, `/profile/[username]`, `/settings`,
`/notifications`, `/me/*`, policy pages, and standalone admin/report/appeal
areas.

## 3. Technology and runtime topology

### Frontend

Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style
primitives, Tiptap 3, TanStack Query, Zustand, DOMPurify, Monaco, Vitest,
Testing Library, jsdom, and accessibility-oriented tests. Tiptap includes
headings, lists/task lists, links, underline, typography, text style, character
count, and custom resizable images.

### Backend

FastAPI, Pydantic v2, Uvicorn, Motor for asynchronous MongoDB, Redis, MinIO,
Meilisearch, Bleach/CSS sanitization, Pillow/media validation, Ruff, pytest,
and pytest-asyncio.

### Local services

The base compose file defines MongoDB 7 with replica-set initialization, Redis
7, Meilisearch, MinIO, backend, and frontend. Production adds Nginx and the
hardening overlay. Monitoring can add Prometheus, Grafana, Loki, and Promtail.

The normal Windows entry point is `scripts/dev.ps1`. Documented local URLs are
frontend `http://localhost:3000`, backend `http://localhost:8000`, and FastAPI
docs `http://localhost:8000/docs`. Do not assume services are running in a new
chat; check health/container state first.

## 4. Backend architecture

The main boundary is `FastAPI route/dependency → service/business logic →
repository/data access → MongoDB document/model`.

The v1 router includes health, achievements, authentication, users, diaries,
comments, social actions, notifications, current-user (`me_`) operations, tags,
discovery, search, reports, media, tickets, admin, warnings, and appeals.

Key responsibilities:

- `core/config.py`: environment settings, media limits, origins, production
  validation.
- security/auth dependencies: password hashing, JWTs, refresh rotation,
  permissions, ban checks.
- `core/sanitize.py`: server-side HTML/CSS allowlists and source policy.
- media validation/services: type sniffing, size/dimension limits, processing,
  object storage, metadata, ownership, proxy access, and cleanup.
- `core/cache.py` and rate-limit utilities: Redis-backed behavior and guarded
  fallback paths.
- `services/diary_service.py`: create/update/delete, privacy, sanitization,
  counters, author enrichment, and media attachment.

Authorization must be enforced by backend dependencies/services, not only by
the UI. The browser cannot be trusted to enforce privacy, ownership, diary
count gates, or media ownership.

## 5. Persistence model

MongoDB is authoritative. The documented model includes users, diaries,
comments, likes, bookmarks, follows, notifications, reports, support tickets,
appeals, audit logs, media, refresh tokens, achievements, and moderation data.

Important user fields include immutable lowercase `username`, Argon2 password
hash, optional encrypted email plus lookup hash, `avatar_path`, profile text,
preferences, denormalized `stats.diary_count`/follower/following counts,
encrypted private-diary master-key material, admin/ban fields, and timestamps.

Important diary concepts include owner ID, public/draft HTML or private
ciphertext, privacy state (`public`, `draft`, or `private`), tags/emotion,
timestamps, publication state, interaction counts, and owned media references.
Counters are updated atomically and maintenance/reconciliation logic exists;
read current schemas and repositories before relying on a denormalized value.

## 6. Privacy and encryption

Private diaries use Web Crypto AES-256-GCM in the browser. The intended key
hierarchy is password → PBKDF2-derived key → protected user-controlled master
key → HKDF-derived per-diary key. The client encrypts title/content/tags before
the API receives them. The server stores ciphertext, does not receive private
plaintext, and does not index private diaries in Meilisearch.

Private entries are owner-only and do not support public comments, likes, or
bookmarks. Private media still has server-side ownership/access rules. A normal
`<img src>` request cannot be assumed to carry a bearer token; use the existing
authenticated media-loading path and manage temporary object URLs safely.

Authentication uses short-lived JWT access tokens and rotatable, one-time-use
refresh tokens in HTTP-only cookies. Passwords use Argon2. Email, when present,
uses field-level encryption plus a uniqueness hash. Never log tokens, passwords,
keys, private diary content, or environment values.

## 7. Editor, sanitizer, and preview behavior

The diary editor is Tiptap with rich formatting, links, task lists, fonts/sizes,
character count, image insertion/resizing, media gallery selection, templates,
autosave/draft recovery, advanced/source mode, and a reader-style preview.

Sanitization happens twice: DOMPurify and application checks in the frontend,
then Bleach/CSS controls in the backend. The allowlist is deliberately narrow;
arbitrary `data-*` attributes are blocked. The intentional app-owned exception
is a valid `data-media-id` on an uploaded image. That ID allows stable media
references and authenticated hydration of private media. The sanitization
warning must not claim a valid media ID will be removed.

### Stable media lifecycle

The intended flow is: file picker/paste/drop → authenticated media upload →
server validation/processing → Mongo media record plus MinIO/S3 variants →
editor image with `data-media-id` → stable
`/api/v1/media/file/{id}?v=...` reference → sanitized diary HTML → hydration in
reader/editor/preview when authentication is required.

Never persist a short-lived signed URL as the permanent diary image source.
Public images may use the stable proxy directly. Private images may need an
authenticated fetch, a browser object URL, and hydration in both the editor and
preview dialog. Compatibility helpers still handle legacy direct URLs.

Recent image work fixed a long-lived failure mode involving obsolete media TTL
indexes and expiring/unauthenticated references, and fixed preview-dialog image
hydration. When touching this area, test a new public diary, a new private
diary, edit, reader page, preview dialog, server restart, and a diary reloaded
later.

## 8. Profile pictures and gating

Profile picture uploads are gated by the backend at 50 diaries, including
private and draft diaries. The UI gate is only a hint; the server is
authoritative. The endpoint is `POST /api/v1/users/me/avatar`. It accepts a
supported image multipart upload, applies the media pipeline, and stores a
stable thumbnail-style URL in `avatar_path`.

The settings flow lets an eligible user select, crop, zoom, preview, and submit
an image. The crop preview must show the selected picture, not a generic icon or
an object URL revoked too early. Avatar components retain initials fallback.
Avatar URLs are reused in profiles, diary cards, comments, notifications,
feeds, and navigation, so URL contract changes have a wide blast radius.

## 9. Frontend/UI conventions

Use TanStack Query for API-backed state and invalidate queries after mutations.
Use Zustand for client-owned cross-component state. Keep auth/privacy
boundaries explicit. Preserve keyboard navigation, visible focus, reduced
motion, responsive layouts, accessible labels, and live regions.

The visual direction combines a calm diary experience with retro-inspired
achievement/badge language. Do not replace a named badge's identity when the
user asked for a focused rendering fix. The editor is dynamically loaded to
control bundle size; avoid importing it into unrelated routes.

## 10. Search, social, moderation

Meilisearch receives only eligible public/searchable diary content. Private and
unpublished content must not leak into search. Index synchronization is
enriched/resumable and excludes banned users according to current service code.

Social actions use ownership/visibility checks and denormalized counts. Public
diaries can receive comments, likes, bookmarks, follows, and notifications as
allowed by settings; private diaries remain owner-only.

Admin/moderation covers reports, tickets, appeals, warnings, bans, user/role
management, hidden content, audit logs, health, and dashboard statistics.
Preserve authorization, audit logging, and rate limits in admin changes.

## 11. Operations and production direction

The production direction is Docker Compose behind Nginx and Cloudflare with
TLS, strict headers/CSP, rate limiting, resource limits, restart policies,
MongoDB replica-set/authentication, Redis persistence, MinIO or S3-compatible
storage, SMTP, centralized logs, monitoring, encrypted off-server backups, and
restore verification.

M15 contains acceptance criteria for DNS/TLS, CI/CD, health, backups,
monitoring, failover, SMTP, and load testing. A compose file or plan is not
evidence that production is live; claim acceptance only with current evidence.
Never commit real credentials; `.env.example` and
`.env.production.example` are templates only.

## 12. Development and testing

Start local development with `.\scripts\dev.ps1`. Full compose development is
`docker compose -f docker-compose.yml up -d`.

Frontend checks from `frontend/`: `npm run typecheck`, `npm run lint`, `npm test`,
and `npm run build`.

Backend checks from `backend/`: `ruff check .`, `ruff format --check .`, and
`python -m pytest -q`.

Combined scripts are `.\scripts\test.ps1` and
`.\scripts\test.ps1 -Frontend`. Use targeted tests while iterating. Full
backend tests can depend on MongoDB, Redis, Meilisearch, or MinIO and may be
affected by existing test data/rate-limit state; distinguish code failures
from environment failures. M14 reports documented 79 frontend tests passing at
that validation point; measure current counts rather than assuming them.

## 13. Current state and recent history

The latest documented roadmap phase is M15 (production deployment). M14 is
documented as engineering-complete with manual device/screen-reader and
environment-dependent caveats. M15 is a deployment/operations plan and
acceptance checklist, not proof of a live deployment.

Recent work includes profile picture gating/cropping, valid media references
through sanitization, authenticated private media loading, preview image
hydration, Bug Catcher badge silhouette correction, production hardening, and
deterministic CI/backend changes. Consult `git log --oneline --decorate` for
authoritative history. Preserve user-owned untracked helper scripts.

## 14. Documentation map

Start with `docs/documentation-index.md`. Key references:

- `README.md`: overview, stack, quick start, security, deployment, CI/CD.
- `docs/architecture.md`: boundaries, schema, encryption, media, search,
  security, privacy, deployment, and scaling.
- `docs/api.md`: REST v1 contracts, media/avatar, diary, social, admin,
  health, and metrics endpoints.
- `docs/database.md`: MongoDB collections, fields, indexes, and lifecycle.
- `docs/security.md` and `docs/security-audit-2026.md`: controls and audit.
- `docs/deployment.md` and `docs/monitoring.md`: release and operations.
- `docs/frontend-design.md`: UI/layout/responsive design intent.
- `docs/roadmap.md`: original phased roadmap.
- `docs/milestones/`: implementation plans and validation reports.
- `docs/diary-*` and `docs/ops`: focused domain and operational guides.

## 15. Mandatory prompt synchronization

Every user prompt handled in this repository must modify both `AGENTS.md` and
`PROJECT_CONTEXT.md` before the response is finished. At the beginning of each
prompt, read both files. At the end, update the `Last prompt synchronization`
line in both with the current date and a concise description of the prompt or
change.

If the prompt changes code, configuration, documentation structure,
directories, APIs, data flow, behavior, tests, or any other part of the
codebase, summarize the durable impact in both files during the same change.
If it does not change the codebase, still update both synchronization lines so
every prompt leaves an auditable synchronization point. Never update only one
file. Keep the entries concise and do not copy prompts, transcripts, secrets,
private diary content, or unredacted logs; link to detailed technical docs or
session summaries when necessary.

Both files must be included in the same commit as any related codebase change
and pushed according to the repository's Git workflow.

## 16. New-chat operating procedure

For each new request: read `AGENTS.md` and this file; check
`git status --short`; identify the affected flow; read the relevant source,
tests, and docs; reproduce/trace a bug end-to-end; make a focused `apply_patch`
change; run relevant validation; modify both Markdown files under the mandatory
synchronization policy; update durable docs/session history when the project
context changed; and commit/push the completed codebase change with a detailed
message according to the project convention.

This is deliberately redundant: `AGENTS.md` supplies rules, this file supplies
the product/architecture model, `docs/` supplies detailed contracts, and
`sessions/` supplies an auditable history of recent work.
