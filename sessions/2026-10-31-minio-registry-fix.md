# MinIO local registry fix — 2026-10-31

## Request

Diagnose and resolve `scripts/dev.ps1` reporting that Docker Desktop was not
running even though Docker Desktop was open.

## Findings

Docker Desktop and the default Docker context were healthy. Direct Compose
output showed no containers were created because the configured
`minio/minio:RELEASE.2024-06-13T22-53-53Z` image could not be pulled from Docker
Hub. After switching local Compose to the compatibility mirror, MongoDB, Redis,
and Meilisearch became healthy, but MinIO could not write to its root-owned
named volume when running non-root.

## Changes

- Updated local `docker-compose.infra.yml` and `docker-compose.yml` to use the
  digest-pinned `bitnamilegacy/minio` compatibility image.
- Adjusted the local MinIO volume and explicit command for the compatibility
  image's `/bitnami/minio/data` layout.
- Configured the local compatibility container to initialize that volume as
  root; production configuration remains unchanged.
- Preserved failed Compose output in `scripts/infra.ps1` instead of discarding
  it.
- Updated backend index reconciliation to reuse existing indexes with matching
  keys/options even when their historical names differ.
- Added focused coverage for legacy-name reuse and TTL-option mismatch.
- Replaced same-name incompatible report indexes and launched Next directly via
  Node so the dashboard tracks the actual frontend process.
- Extended the backend readiness window to 60 seconds for first startup.
- Updated the developer troubleshooting table to identify hidden Compose image
  pull failures.

## Verification

`docker compose config --quiet` passes for both local Compose files,
`scripts/infra.ps1` parses successfully, and `git diff --check` passes. The
focused backend tests pass (`3 passed`), Ruff check/format pass, infrastructure
health passes, and live HTTP probes returned 200 for both `/` on port 3000 and
`/api/v1/health` on port 8000.

## Git

Commit/push was not possible in this session because the managed filesystem
denies writes to `.git`; existing untracked helper files were left untouched.

## Follow-up

Run `docker compose -f .\docker-compose.infra.yml up -d` and then
`.\scripts\dev.ps1 -SkipSetup`. Production MinIO configuration remains a
separate deployment gate and was intentionally not changed.
