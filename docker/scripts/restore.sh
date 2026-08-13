#!/usr/bin/env bash
# Restore MongoDB and MinIO from a backup directory produced by backup.sh.
# Usage: ./docker/scripts/restore.sh <backup_dir>
set -euo pipefail

BACKUP_DIR="${1:?usage: restore.sh <backup_dir>}"
MONGO_CONTAINER="diaryarchive-mongodb-1"
MINIO_CONTAINER="diaryarchive-minio-1"
ENV_FILE=".env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found." >&2
  exit 1
fi
# shellcheck source=/dev/null
set -a; source "$ENV_FILE"; set +a

MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"

if [[ ! -f "$BACKUP_DIR/mongo/archive.gz" ]]; then
  echo "error: no Mongo archive found in $BACKUP_DIR/mongo/archive.gz" >&2
  exit 1
fi

echo "Restoring MongoDB from $BACKUP_DIR/mongo/archive.gz"
docker exec -i "$MONGO_CONTAINER" mongorestore \
  --authenticationDatabase=admin \
  -u "$MONGO_USER" \
  -p "$MONGO_PASS" \
  --drop \
  --archive < "$BACKUP_DIR/mongo/archive.gz"

if [[ -d "$BACKUP_DIR/minio/data" ]]; then
  echo "Restoring MinIO from $BACKUP_DIR/minio/data"
  docker cp "$BACKUP_DIR/minio/data/." "$MINIO_CONTAINER:/data/"
else
  echo "warning: MinIO backup not found under $BACKUP_DIR/minio/data; skipping"
fi

echo "Restore complete. Restart backend to trigger re-indexing if search data is stale."