# DiaryArchive

A place for your thoughts. Public or private.

DiaryArchive is a privacy-first diary platform with **client-side end-to-end encryption** for private entries, a rich-text editor, full-text search, media uploads, community/social features, and a complete moderation/admin suite. Built with **Next.js 15**, **React 19**, **FastAPI**, **MongoDB**, **Redis**, **MinIO**, and **Meilisearch**.

## Highlights

- **End-to-end encryption for private diaries** — content is encrypted in the browser (AES-256-GCM via the Web Crypto API) before it ever reaches the server; the server never sees private plaintext or stores keys. Password → PBKDF2-derived key → protects a user-controlled AES-256-GCM master key → HKDF per-diary keys.
- **Public diaries** — content is sanitized (bleach/DOMPurify allow-lists) and indexable; searchable via Meilisearch.
- **Rich text editor** — Tiptap (headings, task lists, links, underlines, custom resizable images, font-family/size, character count).
- **Community** — comments (threaded), likes, bookmarks, follows, notifications, user profiles, achievements/badges.
- **Moderation & admin suite** — reports, support tickets, ban appeals, user management, role management, warnings system, content hiding, audit logs, health, and dashboard stats.
- **Media** — image/video/audio uploads with MIME sniffing and size/dimension validation, stored in MinIO; presigned URLs for private media.
- **Full-text search** — Meilisearch with an enriched, resumable index (excludes banned users, retries with backoff).
- **Hardenable production deploy** — Docker Compose + Nginx reverse proxy with TLS, rate limiting, caching, security headers, and fail-closed secret validation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style components, Zustand, TanStack Query, Tiptap |
| Backend | FastAPI, Pydantic v2, Motor (async MongoDB), Redis |
| Databases | MongoDB 7 (authoritative store), Redis (rate limiting) |
| Search | Meilisearch (`public_diaries` index) |
| Object storage | MinIO (media files) |
| Reverse proxy | Nginx (TLS, rate limiting, caching, security headers) |
| Testing | pytest (backend), Vitest + Testing Library (frontend) |
| CI/CD | GitHub Actions (lint, test, docker build, deploy) |

## Architecture

```
          Cloudflare (DNS/CDN, optional)
                    │
                Nginx ── TLS, rate limiting, caching, security headers
               /    \
        frontend     backend
        (Next.js)     (FastAPI)
              \         │
               └────┬───┘
               Redis (rate limiting)
               MongoDB (store)
               Meilisearch (search)
               MinIO (media)
```

The repository is a monorepo:

```
diaryarchive/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── api/        # v1 route modules + FastAPI dependencies
│   │   ├── core/       # config, security, middleware, database, sanitize, media validation
│   │   ├── models/     # MongoDB document shapes
│   │   ├── schemas/    # Pydantic request/response + MongoDB index definitions
│   │   ├── repositories/  # Data access layer (one per collection)
│   │   ├── services/   # Business logic layer
│   │   ├── search/     # Meilisearch config, indexer, enricher, sync
│   │   └── tasks/      # Background jobs (warning enforcement)
│   └── tests/          # pytest suite (API + repositories)
├── frontend/           # Next.js application
│   └── src/
│       ├── app/        # Pages & layouts (public, auth, admin, editor)
│       ├── components/ # UI, layouts, editor, social, admin components
│       ├── hooks/      # React Query hooks + client state hooks
│       ├── lib/        # API client, crypto, sanitize, media validation, utils
│       ├── store/      # Zustand stores (auth, explore)
│       └── tests/      # Vitest unit tests
├── docs/               # api.md, architecture.md, roadmap.md, milestone plans, skill guides
├── docker/            # Nginx config + ops scripts (backup/restore/provision/loadtest)
├── scripts/           # PowerShell dev scripts (Windows)
├── docker-compose.yml            # Base full-stack compose
├── docker-compose.infra.yml      # Dev-only infrastructure (MongoDB/Redis/Meilisearch/MinIO)
└── docker-compose.prod.yml       # Production hardening overlay
```

## Quick Start (Development)

**Prerequisites:** [Python 3.13+](https://www.python.org/downloads/), [Node.js 18+](https://nodejs.org/en/download/), [Docker Desktop](https://www.docker.com/products/docker-desktop/), [PowerShell 5.1+](https://learn.microsoft.com/powershell/) (Windows) or bash (macOS/Linux via the compose files).

```powershell
# One command: install deps, start infra (Mongo, Redis, Meilisearch, MinIO), run both servers
.\scripts\dev.ps1
```

This starts everything with hot reload.

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs

### Alternative: full Docker Compose stack

To run the whole application (including Nginx) in containers:

```powershell
docker compose -f docker-compose.yml up -d
```

## Available Scripts (Windows / PowerShell)

| Command | What it does |
|---------|-------------|
| `.\scripts\dev.ps1` | Full dev environment (setup + infra + servers + dashboard) |
| `.\scripts\setup.ps1` | Check prerequisites and install backend/frontend dependencies |
| `.\scripts\infra.ps1` | Start MongoDB + Redis + Meilisearch + MinIO via Docker |
| `.\scripts\stop.ps1` | Stop all services |
| `.\scripts\test.ps1` | Run backend tests |
| `.\scripts\test.ps1 -Frontend` | Run backend + frontend tests |

## Environment Setup

Development environment variables are pre-configured in:

- `backend/.env.development` — backend settings (loaded automatically by Pydantic)
- `frontend/.env.development` — frontend settings (loaded by Next.js)

For local overrides, create `backend/.env` (gitignored). A template lives at `.env.example`.

Production envs (fail-closed, gitignored) are documented in `.env.production.example` — copy it to `.env.production` and generate strong secrets (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`). Outside `DEBUG` mode the backend rejects weak/default secret values on startup.

## Testing

```powershell
# Backend tests
.\scripts\test.ps1

# Backend + frontend tests
.\scripts\test.ps1 -Frontend

# Frontend unit tests (Vitest)
cd frontend && npm test
```

## Linting & Type Checking

```powershell
# Backend (ruff)
cd backend && ruff check . && ruff format --check .

# Frontend (ESLint)
cd frontend && npm run lint

# TypeScript check
cd frontend && npm run typecheck
```

## Security

- **JWT access tokens** (short-lived, HS256) + **rotatable, one-time-use refresh tokens** stored hashed in MongoDB and delivered via HTTP-only cookies.
- **Argon2** password hashing.
- **End-to-end encryption** for private diaries (AES-256-GCM; PBKDF2 key derivation, HKDF per-diary keys, user-controlled master key). See `docs/architecture.md`.
- **Field-level email encryption** (AES-256-GCM) plus hashed email lookup values so plaintext emails are never stored.
- **Rate limiting** on all hot/auth endpoints (Redis sliding window with an in-process fail-closed fallback), policy centralized in `backend/app/core/config.py`.
- **Security headers + strict Content-Security-Policy** via middleware; reverse-proxy Nginx adds HSTS, rate-limit zones, and CORS controls.
- **Content sanitization** (bleach / DOMPurify) with allow-lists of tags, attributes, and CSS.
- **Media validation** — MIME magic-byte sniffing and size / dimension limits.
- **Fail-closed secret validation** — the backend refuses to start in production with weak or committed default secrets.

## Deployment (Production)

Full production run uses the overlay on top of the base compose file:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The production overlay adds:

- **Nginx** reverse proxy on 80/443 (TLS), gzip, client-body limits, and rate limiting per zone.
- **Fail-closed required secrets** — startup aborts if `MONGO_ROOT_USER/PASSWORD`, `REDIS_PASSWORD`, `MEILI_MASTER_KEY`, `MINIO_ACCESS/SECRET_KEY`, `SECRET_KEY`, or `EMAIL_ENCRYPTION_KEY` are unset.
- **Image pins**, resource limits/reservations, `restart: always`, healthchecks, and **2 backend replicas**.
- **Redis with AOF persistence** and a `requirepass`; **Meilisearch in production mode**; frontend **not exposed** on a public host port (traffic goes through Nginx only).

### Provisioning & Operations Scripts (`docker/scripts/`)

| Script | Purpose |
|--------|---------|
| `provision.sh` | One-time Ubuntu/Debian server provisioning (Docker install + first deploy) |
| `backup.sh` | MongoDB (mongodump) + MinIO backup to a timestamped directory |
| `restore.sh` | Restore MongoDB + MinIO from a backup |
| `loadtest.sh` | Smoke + load test (Apache Bench) against the deployed stack |
| `deploy.yml` (in `.github/workflows/`) | SSH-based deploy on push to `main` |

TLS certificates are expected at `docker/nginx/certs/{fullchain,privkey}.pem` (e.g. obtain via `certbot --nginx`). Deploy automation requires the GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PORT` and variable `DEPLOY_DIR`.

## Documentation

The full REST API v1 reference is in [`docs/api.md`](docs/api.md). Architecture, database design, roadmap, milestone plans, and skill guides live under [`docs/`](docs/).

## License

Add your license here (e.g. MIT, Apache-2.0).