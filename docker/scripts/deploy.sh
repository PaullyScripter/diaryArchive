#!/usr/bin/env bash
# Production-safe deployment for DiaryArchive (single-host Docker Compose).
#
#   - Identifies the deploy by git commit SHA (immutable tag).
#   - Runs a migration/index stage BEFORE the new version goes live.
#   - Builds and starts the new stack, then health-checks it.
#   - On health failure: stops the rollout and rolls back to the previous
#     known-good deployment, then reports failure loudly.
#
# Usage:
#   ./docker/scripts/deploy.sh [git_ref]
#   # git_ref defaults to HEAD. It MUST have a corresponding .env.production.
set -euo pipefail

ENV_FILE=".env.production"
COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.prod.yml)
GIT_REF="${1:-HEAD}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found. Deploy refuses to continue without secrets." >&2
  exit 1
fi
# shellcheck source=/dev/null
set -a; source "$ENV_FILE"; set +a

echo "==> Deploying $(git rev-parse --short HEAD) ($GIT_REF)"

# Save the current deployment SHA for rollback (best-effort).
PREV_SHA="$(cat .last-deployed-sha 2>/dev/null || echo none)"
echo "   previous deployment: $PREV_SHA"

# ---------------------------------------------------------------------------
# 1. Pull the requested ref and verify it builds.
# ---------------------------------------------------------------------------
git fetch --all --tags
git checkout "$GIT_REF" --force

echo "==> Migration / index preparation stage"
# Runs inside the backend container: ensures required indexes and any pending
# data migrations exist BEFORE the new version serves traffic. Idempotent.
if docker compose "${COMPOSE_ARGS[@]}" ps --services | grep -q backend; then
  docker compose "${COMPOSE_ARGS[@]}" run --rm backend \
    python -m app.migrations.run_migrations || {
      echo "FAIL: migration stage failed. Aborting rollout." >&2
      exit 1
    }
else
  echo "   backend not currently running; migration deferred to startup."
fi

# ---------------------------------------------------------------------------
# 2. Build the new images (immutable by commit tag).
# ---------------------------------------------------------------------------
TAG="$(git rev-parse --short HEAD)"
docker compose "${COMPOSE_ARGS[@]}" build

# ---------------------------------------------------------------------------
# 3. Bring up the new stack.
# ---------------------------------------------------------------------------
docker compose "${COMPOSE_ARGS[@]}" up -d

# ---------------------------------------------------------------------------
# 4. Health-check the rollout.
# ---------------------------------------------------------------------------
echo "==> Waiting for backend health..."
for i in $(seq 1 60); do
  if curl -fsS --retry 1 http://localhost/api/v1/health >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

if curl -fsS --retry 1 http://localhost/api/v1/health >/dev/null 2>&1; then
  echo "$(git rev-parse --short HEAD)" > .last-deployed-sha
  echo "==> Deploy SUCCESS (tag $TAG)."
else
  echo "FAIL: health check did not pass after deploy." >&2
  # ---------------------------------------------------------------------------
  # 5. Rollback to previous known-good deployment.
  # ---------------------------------------------------------------------------
  if [[ "$PREV_SHA" != "none" ]]; then
    echo "==> Rolling back to $PREV_SHA"
    git checkout "$PREV_SHA" --force
    docker compose "${COMPOSE_ARGS[@]}" build
    docker compose "${COMPOSE_ARGS[@]}" up -d
    if curl -fsS --retry 3 http://localhost/api/v1/health >/dev/null 2>&1; then
      echo "==> Rollback SUCCESS. A broken release was not left serving traffic."
    else
      echo "CRITICAL: rollback also failed. Manual intervention required." >&2
    fi
  else
    echo "CRITICAL: no previous deployment known; manual rollback required." >&2
  fi
  exit 1
fi

docker image prune -f >/dev/null 2>&1 || true
echo "==> Deploy complete."