#!/usr/bin/env bash
# Isolated restore verification for age-encrypted backups.
set -euo pipefail

BACKUP_DIR="${1:?usage: verify-restore-age.sh <backup_dir>}"
ENV_FILE="${ENV_FILE:-.env.production}"
VERIFY_CONTAINER="diaryarchive-verify-age-mongo"
SCRATCH_MINIO="$BACKUP_DIR/.verify-age-minio"
DB="diaryarchive"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a
fi

command -v age >/dev/null 2>&1 || { echo "FAIL: age is required" >&2; exit 1; }
: "${BACKUP_AGE_IDENTITY_FILE:?set BACKUP_AGE_IDENTITY_FILE}"
MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"

for artifact in mongo.archive.age minio.tar.age checksums.sha256; do
  [[ -s "$BACKUP_DIR/$artifact" ]] || {
    echo "FAIL: missing or empty backup artifact: $BACKUP_DIR/$artifact" >&2
    exit 1
  }
done
(cd "$BACKUP_DIR" && sha256sum --check checksums.sha256)

cleanup() {
  docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$SCRATCH_MINIO"
}
trap cleanup EXIT

docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$VERIFY_CONTAINER" \
  -e MONGO_INITDB_ROOT_USERNAME="$MONGO_USER" \
  -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_PASS" \
  mongo:7.0@sha256:8bb4442761a63a8dda452744082eb977b42324a63cef59ca4 >/dev/null

READY=0
for _ in $(seq 1 30); do
  if docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
      -u "$MONGO_USER" -p "$MONGO_PASS" \
      --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
[[ "$READY" -eq 1 ]] || { echo "FAIL: scratch Mongo did not become ready" >&2; exit 1; }

age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" "$BACKUP_DIR/mongo.archive.age" \
  | docker exec -i "$VERIFY_CONTAINER" mongorestore \
      --authenticationDatabase=admin -u "$MONGO_USER" -p "$MONGO_PASS" --archive

for coll in users diaries; do
  count="$(docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
    -u "$MONGO_USER" -p "$MONGO_PASS" \
    --eval "db.getSiblingDB(\"$DB\").$coll.countDocuments({})")"
  [[ -n "$count" && "$count" != "0" ]] || {
    echo "FAIL: $coll collection empty/unreadable" >&2
    exit 1
  }
  echo "OK: $coll = $count"
done

mkdir -p "$SCRATCH_MINIO"
age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" "$BACKUP_DIR/minio.tar.age" \
  | tar -C "$SCRATCH_MINIO" -xf -
MEDIA_FILES="$(find "$SCRATCH_MINIO" -type f | wc -l)"
echo "OK: $MEDIA_FILES media object(s) present"
echo "VERIFY-RESTORE-AGE PASSED"
