#!/usr/bin/env bash
# Restore MongoDB + MinIO from an encrypted backup directory produced by
# backup.sh.
#
# SAFETY: restoring with --drop is DESTRUCTIVE and can erase the live database.
# It therefore requires an explicit confirmation:
#   CONFIRM_PRODUCTION_RESTORE=yes   to allow --drop against the live DB.
# Without it, the script refuses to run a destructive restore. Restoring into a
# scratch/verification environment (see verify-restore.sh) needs no such guard.
#
# Usage:
#   CONFIRM_PRODUCTION_RESTORE=yes ./docker/scripts/restore.sh <backup_dir>
#
# Env:
#   BACKUP_ENCRYPTION_KEY   must match the one used to create the backup
set -euo pipefail

BACKUP_DIR="${1:?usage: restore.sh <backup_dir>}"
MONGO_CONTAINER="${MONGO_CONTAINER:-diaryarchive-mongodb-1}"
MINIO_CONTAINER="${MINIO_CONTAINER:-diaryarchive-minio-1}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a
fi

: "${BACKUP_ENCRYPTION_KEY:?set BACKUP_ENCRYPTION_KEY (must match backup)}"
MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"

if [[ ! -f "$BACKUP_DIR/mongo.archive.enc" ]]; then
  echo "error: no encrypted Mongo archive found: $BACKUP_DIR/mongo.archive.enc" >&2
  exit 1
fi

# Destructive restore requires explicit human confirmation.
DESTRUCTIVE="${CONFIRM_PRODUCTION_RESTORE:-no}"
if [[ "$DESTRUCTIVE" != "yes" ]]; then
  echo "Refusing destructive restore: set CONFIRM_PRODUCTION_RESTORE=yes to allow" >&2
  echo "--drop against the live database. For a scratch/verification restore use" >&2
  echo "verify-restore.sh instead." >&2
  exit 1
fi

echo "==> Restoring MongoDB from $BACKUP_DIR/mongo.archive.enc (with --drop)"
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$BACKUP_DIR/mongo.archive.enc" \
  | docker exec -i "$MONGO_CONTAINER" mongorestore \
      --authenticationDatabase=admin \
      -u "$MONGO_USER" -p "$MONGO_PASS" \
      --drop --archive

if [[ -f "$BACKUP_DIR/minio.tar.enc" ]]; then
  echo "==> Restoring MinIO from $BACKUP_DIR/minio.tar.enc"
  openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_KEY \
    -in "$BACKUP_DIR/minio.tar.enc" \
    | docker exec -i "$MINIO_CONTAINER" tar -C /data -xf -
else
  echo "warning: MinIO backup not found; skipping."
fi

echo "Restore complete. Restart backend to trigger re-indexing if search data is stale."
echo "NOTE: Meilisearch is not stored in backups; reindex from MongoDB after restore."