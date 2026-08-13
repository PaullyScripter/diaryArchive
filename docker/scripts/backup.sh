#!/usr/bin/env bash
# Backup MongoDB, MinIO, and Meilisearch to a timestamped directory on the host.
# Usage: ./docker/scripts/backup.sh [backup_dir]
set -euo pipefail

BACKUP_DIR="${1:-./backups/$(date +%Y%m%d-%H%M%S)}"
MONGO_CONTAINER="diaryarchive-mongodb-1"
MINIO_CONTAINER="diaryarchive-minio-1"
ENV_FILE=".env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found. Source it or create from .env.example." >&2
  exit 1
fi
# shellcheck source=/dev/null
set -a; source "$ENV_FILE"; set +a

MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"

mkdir -p "$BACKUP_DIR/mongo" "$BACKUP_DIR/minio" "$BACKUP_DIR/meili"

echo "Backing up MongoDB -> $BACKUP_DIR/mongo"
docker exec "$MONGO_CONTAINER" mongodump \
  --authenticationDatabase=admin \
  -u "$MONGO_USER" \
  -p "$MONGO_PASS" \
  --archive > "$BACKUP_DIR/mongo/archive.gz"

echo "Backing up MinIO -> $BACKUP_DIR/minio"
docker cp "$MINIO_CONTAINER:/data/." "$BACKUP_DIR/minio/"

echo "Backup complete: $BACKUP_DIR"
echo "NOTE: Meilisearch is a rebuildable index. Re-run 'make reindex' or let the app
reindex from MongoDB after restore instead of snapshotting its native store."