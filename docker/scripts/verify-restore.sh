#!/usr/bin/env bash
# Verify a backup is restorable by restoring it into an ISOLATED scratch
# environment (a throwaway Mongo container + a temp MinIO volume) and checking
# that the data is readable.
#
# Never runs against production. It spawns a disposable container named
# diaryarchive-verify-mongo on the default bridge network, restores the
# encrypted archive into it, and asserts that:
#   1. The users collection is non-empty and readable.
#   2. A representative media object survives in the MinIO tar.
#
# Usage:
#   ./docker/scripts/verify-restore.sh <backup_dir>
#
# Env:
#   BACKUP_ENCRYPTION_KEY   must match the backup's key
set -euo pipefail

BACKUP_DIR="${1:?usage: verify-restore.sh <backup_dir>}"
ENV_FILE="${ENV_FILE:-.env.production}"
VERIFY_CONTAINER="diaryarchive-verify-mongo"
SCRATCH_MINIO="$BACKUP_DIR/.verify-minio"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a
fi

: "${BACKUP_ENCRYPTION_KEY:?set BACKUP_ENCRYPTION_KEY}"
MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"

if [[ ! -f "$BACKUP_DIR/mongo.archive.enc" ]]; then
  echo "FAIL: no encrypted Mongo archive: $BACKUP_DIR/mongo.archive.enc" >&2
  exit 1
fi

cleanup() {
  docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$SCRATCH_MINIO"
}
trap cleanup EXIT

echo "==> Starting scratch Mongo container (isolated, ephemeral)"
docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$VERIFY_CONTAINER" -e MONGO_INITDB_ROOT_USERNAME="$MONGO_USER" \
  -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_PASS" mongo:7 >/dev/null

echo "==> Restoring encrypted archive into scratch (NO --drop needed; empty DB)"
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$BACKUP_DIR/mongo.archive.enc" \
  | docker exec -i "$VERIFY_CONTAINER" mongorestore \
      --authenticationDatabase=admin \
      -u "$MONGO_USER" -p "$MONGO_PASS" \
      --archive

echo "==> Verifying Mongo collections are readable"
# Wait for mongosh availability.
for _ in $(seq 1 30); do
  if docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
      -u "$MONGO_USER" -p "$MONGO_PASS" \
      --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

USER_COUNT=$(docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --eval 'db.getSiblingDB("diaryarchive").users.countDocuments({})')
if [[ -z "$USER_COUNT" || "$USER_COUNT" == "0" ]]; then
  echo "FAIL: users collection empty/unreadable in scratch restore (count=$USER_COUNT)" >&2
  exit 1
fi
echo "   OK: users count = $USER_COUNT"

echo "==> Verifying MinIO media is present in the tar"
mkdir -p "$SCRATCH_MINIO"
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$BACKUP_DIR/minio.tar.enc" \
  | tar -C "$SCRATCH_MINIO" -xf -
MEDIA_FILES=$(find "$SCRATCH_MINIO" -type f | wc -l)
if [[ "$MEDIA_FILES" -eq 0 ]]; then
  echo "FAIL: no media objects present in MinIO backup" >&2
  exit 1
fi
echo "   OK: $MEDIA_FILES media object(s) present"

echo "VERIFY-RESTORE PASSED: backup is restorable and readable."