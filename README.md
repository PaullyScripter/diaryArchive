# DiaryArchive

A place for your thoughts. Public or private.

DiaryArchive is a privacy-first diary platform with **client-side end-to-end encryption** for private entries, a rich-text editor, full-text search, media uploads, community/social features, and a complete moderation/admin suite. Built with **Next.js 15**, **React 19**, **FastAPI**, **MongoDB**, **Redis**, **MinIO**, and **Meilisearch**.

## Highlights

- **End-to-end encryption for private diaries** - content is encrypted in the browser (AES-256-GCM via the Web Crypto API) before it ever reaches the server; the server never sees private plaintext or stores keys. Password → PBKDF2-derived key → protects a user-controlled AES-256-GCM master key → HKDF per-diary keys.
- **Public diaries** - content is sanitized (bleach/DOMPurify allow-lists) and indexable; searchable via Meilisearch.
- **Rich text editor** - Tiptap (headings, task lists, links, underlines, custom resizable images, font-family/size, character count).
- **Community** - comments (threaded), likes, bookmarks, follows, notifications, user profiles, achievements/badges.
- **Moderation & admin suite** - reports, support tickets, ban appeals, user management, role management, warnings system, content hiding, audit logs, health, and dashboard stats.
- **Media** - image/video/audio uploads with MIME sniffing and size/dimension validation, stored in MinIO; presigned URLs for private media.
- **Full-text search** - Meilisearch with an enriched, resumable index (excludes banned users, retries with backoff).
- **Hardenable production deploy** - Docker Compose + Nginx reverse proxy with TLS, rate limiting, caching, security headers, and fail-closed secret validation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style components, Zustand, TanStack Query, Tiptap |
| Backend | FastAPI, Pydantic v2, Motor (async MongoDB), Redis |
| Databases | MongoDB 7 (authoritative store), Redis (rate limiting + caching) |
| Search | Meilisearch (`public_diaries` index) |
| Object storage | MinIO (media files) |
| Reverse proxy | Nginx (TLS, rate limiting, caching, security headers) |
| Monitoring | Prometheus, Grafana, Loki, Promtail (optional via compose overlay) |
| Testing | pytest (backend), Vitest + Testing Library (frontend), k6 (load testing) |
| CI/CD | GitHub Actions (lint, test, docker build, deploy, Slack notification) |

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
               Redis (rate limiting + caching)
               MongoDB (store)
               Meilisearch (search)
               MinIO (media)

  Optional monitoring stack:
  Prometheus ──▶ Grafana ◀── Loki ◀── Promtail
```

The repository is a monorepo:

```
diaryarchive/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── api/        # v1 route modules + FastAPI dependencies
│   │   ├── core/       # config, security, middleware, database, sanitize, media validation, cache, metrics
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
├── docs/               # api.md, architecture.md, monitoring.md, security.md, milestone plans
├── docker/             # Nginx, Redis, MongoDB, Loki, Promtail, Grafana configs + ops scripts
├── scripts/            # PowerShell dev scripts + k6 load tests
├── docker-compose.yml            # Base full-stack compose
├── docker-compose.prod.yml       # Production hardening overlay
├── docker-compose.monitoring.yml # Optional monitoring stack (Prometheus, Grafana, Loki)
└── docker-compose.infra.yml      # Dev-only infrastructure (MongoDB/Redis/Meilisearch/MinIO)
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

- `backend/.env.development` - backend settings (loaded automatically by Pydantic)
- `frontend/.env.development` - frontend settings (loaded by Next.js)

For local overrides, create `backend/.env` (gitignored). A template lives at `.env.example`.

Production envs (fail-closed, gitignored) are documented in `.env.production.example` - copy it to `.env.production` and generate strong secrets (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`). Outside `DEBUG` mode the backend rejects weak/default secret values on startup.

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
- **Redis caching** for public feeds and notification counts (30s TTL, private data never cached, graceful fallback if Redis is unavailable).
- **Security headers + strict Content-Security-Policy** via middleware; reverse-proxy Nginx adds HSTS, rate-limit zones, and CORS controls.
- **Content sanitization** (bleach / DOMPurify) with allow-lists of tags, attributes, and CSS.
- **Media validation** - MIME magic-byte sniffing and size / dimension limits.
- **Fail-closed secret validation** - the backend refuses to start in production with weak or committed default secrets.
- **Health endpoint** exposes version, commit hash, deployment time, and uptime for monitoring.

## Deployment (Production)

Full production run uses the overlay on top of the base compose file:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

With optional monitoring stack:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
```

The production overlay adds:

- **Nginx** reverse proxy on 80/443 (TLS) with separate vhosts for `diaryarchive.com` and `api.diaryarchive.com`, gzip, client-body limits, and rate limiting per zone.
- **Fail-closed required secrets** - startup aborts if `MONGO_ROOT_USER/PASSWORD`, `REDIS_PASSWORD`, `MEILI_MASTER_KEY`, `MINIO_ACCESS/SECRET_KEY`, `SECRET_KEY`, or `EMAIL_ENCRYPTION_KEY` are unset.
- **Image pins**, resource limits/reservations, `restart: always`, healthchecks.
- **Redis** with AOF persistence, RDB snapshots, maxmemory (128MB), and `requirepass`.
- **MongoDB** with keyfile authentication (auto-generated by provisioning script).
- **Meilisearch** in production mode; frontend **not exposed** on a public host port (traffic goes through Nginx only).

### Monitoring Stack (`docker-compose.monitoring.yml`)

| Service | Purpose |
|---------|---------|
| Prometheus | Metrics collection (scrapes backend `/api/v1/metrics`) |
| Grafana | Dashboards for system health, request rates, latency percentiles |
| Loki | Log aggregation from Docker containers |
| Promtail | Log collection and forwarding to Loki |

### CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

| Job | Trigger | What it does |
|-----|---------|--------------|
| **test** | Every push/PR | Gitleaks secret scan, dependency audit, backend lint + tests, frontend lint + tests + build, Docker image build validation |
| **deploy** | Push to `main` only | SSH deploy with auto-rollback on health check failure, Slack notification on success/failure |

### Provisioning & Operations Scripts (`docker/scripts/`)

| Script | Purpose |
|--------|---------|
| `provision.sh` | One-time Ubuntu/Debian server provisioning (Docker, UFW, MongoDB keyfile, first deploy) |
| `deploy.sh` | Production-safe deployment with commit-SHA tagging, migration stage, health checks, and auto-rollback |
| `backup.sh` | MongoDB (mongodump) + MinIO encrypted backup with rotation (daily/weekly/monthly) |
| `restore.sh` | Restore MongoDB + MinIO from backup (with safety snapshot) |
| `verify-restore.sh` | Verify backup integrity in isolated container |
| `loadtest.sh` | Smoke + load test (Apache Bench) |
| `loadtest.js` (in `scripts/`) | k6 load test (200 concurrent users, P95 <500ms, <1% errors) |

TLS certificates are expected at `docker/nginx/certs/{fullchain,privkey}.pem` (e.g. Cloudflare Origin CA). Deploy automation requires the GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PORT` and variable `DEPLOY_DIR`.

## Documentation

The full REST API v1 reference is in [`docs/api.md`](docs/api.md). Architecture, database design, monitoring setup, security configuration, milestone plans, and skill guides live under [`docs/`](docs/).

For future contributors and Codex sessions, start with [`AGENTS.md`](AGENTS.md),
the detailed [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), and the
[`documentation index`](docs/documentation-index.md). Recent work summaries are
kept in [`sessions/`](sessions/), and milestone status is indexed in
[`docs/milestones/README.md`](docs/milestones/README.md).

## License

Licensed under the **Business Source License 1.1** (BUSL-1.1). Source is openly available; non-production, non-commercial use is free, but production or commercial use requires a separate license from the licensor. See [`LICENSE`](LICENSE).

On **2032** (the Change Date), the Licensed Work converts to the **MIT License** and becomes fully open source.
