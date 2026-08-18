# Deployment

Production deployment for DiaryArchive targets a single-host Docker Compose
stack sized for an initial ~10,000 users. Every service is designed to scale
horizontally later.

## Architecture

```
Cloudflare (TLS, CDN, DDoS)
  -> Nginx (reverse proxy, TLS termination, security headers)
       -> Next.js (frontend)
       -> FastAPI (backend) -> Redis, MongoDB, MinIO, Meilisearch
```

## Compose files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base definition; internal services `expose:` only |
| `docker-compose.infra.yml` | Local dev: publishes MongoDB/Redis/Meilisearch/MinIO ports |
| `docker-compose.override.yml` | Dev-only port publishing (dev native-run workflow) |
| `docker-compose.prod.yml` | Production overlay: nginx on 80/443, replicas, hardened containers |

Production uses `docker-compose.yml` + `docker-compose.prod.yml`. Hardening
applied to the prod overlay includes `read_only`, `no-new-privileges`,
`cap_drop`, and an nginx `tmpfs` mount for runtime writable space.

## Environment

- All secrets live in `.env.production`, which is **git-ignored** and never
  committed. `deploy.sh` and `provision.sh` refuse to run without it.
- `docker/nginx/certs/{fullchain,privkey}.pem` hold TLS certificates.
- Key variables include: `MONGODB_URI`, `REDIS_URI`, `MEILISEARCH_URL` /
  `MEILISEARCH_API_KEY`, `MINIO_*`, `SECRET_KEY`, `BACKUP_ENCRYPTION_KEY`,
  `PUBLIC_API_URL`, `PUBLIC_MEDIA_BASE_URL`, `MONGO_ROOT_USER` /
  `MONGO_ROOT_PASSWORD`, and the log-retention / backup-retention knobs in
  `backend/app/core/config.py`.

## Provisioning a new server

```bash
# As root, with .env.production present:
DOMAIN=diaryarchive.com ./docker/scripts/provision.sh
```

This installs Docker + the compose plugin, seeds certs, and starts the stack.
TLS certificates are expected at `docker/nginx/certs/` (e.g. obtain via
`certbot --nginx -d $DOMAIN -d api.$DOMAIN` then copy).

## Deploying a release

Deployments are identified by an **immutable git commit SHA**:

```bash
# Deploy current HEAD
./docker/scripts/deploy.sh

# Deploy a specific ref
./docker/scripts/deploy.sh v1.2.0
```

`deploy.sh` performs, in order:

1. Fetches and checks out the target ref.
2. Runs the **migration/index stage** (`python -m app.migrations.run_migrations`)
   inside the backend container before the new version serves traffic.
3. Builds the new images, tagged by commit SHA.
4. Brings the stack up and health-checks `/api/v1/health`.
5. On health failure, **rolls back** to the previous known-good SHA
   (`.last-deployed-sha`) and reports the failure loudly.

## Migrations

- Versioned, idempotent MongoDB migrations live in
  `backend/app/migrations/run_migrations.py` and are tracked in a
  `schema_migrations` collection.
- Each migration runs at most once, is safe to re-run if partially applied,
  and is invoked by `deploy.sh` — never blocking normal startup.

## Rollback

`deploy.sh` handles rollback automatically when a new release fails its health
check. To roll back manually after a known-good deploy:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
git checkout <PREV_SHA> --force
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Data is preserved across deploys because MongoDB/Redis/MinIO volumes persist
independently of the application containers.

## Observability

- `GET /api/v1/health` reports per-dependency status (MongoDB, Redis, MinIO,
  Meilisearch) and returns 503 when any dependency is unreachable.
- `GET /api/v1/metrics` exposes lightweight Prometheus-formatted counters
  (request totals/errors by route, request latency, periodic-task summaries)
  for scraping by Prometheus/Grafana.

## Related

- [Backup, restore & encryption rotation](ops/backup-restore.md)
- [Architecture](architecture.md)
- [Security audit](security-audit-2026.md)