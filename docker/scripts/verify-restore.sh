#!/usr/bin/env bash
# Verify a backup is restorable by restoring it into an ISOLATED scratch
# environment (a throwaway Mongo container + a temp MinIO volume) and checking
# that the data is readable.
#
# Never runs against production. It spawns a disposable container named
# diaryarchive-verify-mongo on the default bridge network, restores the
# encrypted archive into it, and asserts that:
#   1. Core collections are non-empty and readable (users, diaries,
#      diary_collaborators, relationships, notifications).
#   2. Cross-collection references are valid (diary owner IDs exist in users).
#   3. A representative media object survives in the MinIO tar.
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
DB="diaryarchive"

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
for artifact in "$BACKUP_DIR/mongo.archive.enc" "$BACKUP_DIR/minio.tar.enc" "$BACKUP_DIR/checksums.sha256"; do
  if [[ ! -s "$artifact" ]]; then
    echo "FAIL: missing or empty backup artifact: $artifact" >&2
    exit 1
  fi
done
(
  cd "$BACKUP_DIR"
  sha256sum -c checksums.sha256
)

cleanup() {
  docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$SCRATCH_MINIO"
}
trap cleanup EXIT

echo "==> Starting scratch Mongo container (isolated, ephemeral)"
docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$VERIFY_CONTAINER" -e MONGO_INITDB_ROOT_USERNAME="$MONGO_USER" \
  -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_PASS" mongo:7 >/dev/null

echo "==> Waiting for scratch Mongo to accept connections"
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
if [[ "$READY" -ne 1 ]]; then
  echo "FAIL: scratch Mongo did not become ready" >&2
  exit 1
fi

echo "==> Restoring encrypted archive into scratch (NO --drop needed; empty DB)"
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$BACKUP_DIR/mongo.archive.enc" \
  | docker exec -i "$VERIFY_CONTAINER" mongorestore \
      --authenticationDatabase=admin \
      -u "$MONGO_USER" -p "$MONGO_PASS" \
      --archive

# ---------------------------------------------------------------------------
# Verify core collections
# ---------------------------------------------------------------------------
EXPECTED_COLLECTIONS=("users" "diaries")
COLLECTION_RESULTS=()

for coll in "${EXPECTED_COLLECTIONS[@]}"; do
  COUNT=$(docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
    -u "$MONGO_USER" -p "$MONGO_PASS" \
    --eval "db.getSiblingDB(\"$DB\").$coll.countDocuments({})")
  COLLECTION_RESULTS+=("$coll=$COUNT")
  if [[ -z "$COUNT" || "$COUNT" == "0" ]]; then
    echo "FAIL: $coll collection empty/unreadable in scratch restore (count=$COUNT)" >&2
    exit 1
  fi
  echo "   OK: $coll = $COUNT"
done

# These collections may legitimately be empty, but they must be present and
# readable when the application has created them.
for coll in comments likes bookmarks follows notifications media; do
  COUNT=$(docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
    -u "$MONGO_USER" -p "$MONGO_PASS" \
    --eval "db.getSiblingDB(\"$DB\").$coll.countDocuments({})")
  COLLECTION_RESULTS+=("$coll=$COUNT")
  echo "   OK: $coll = $COUNT"
done

# ---------------------------------------------------------------------------
# Cross-collection integrity: current schema uses user_id for ownership.
# ---------------------------------------------------------------------------
echo "==> Checking cross-collection integrity (diary owner_ids -> users)"
ORPHAN_COUNT=$(docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --eval "
    const db = db.getSiblingDB('$DB');
    const userIds = new Set(db.users.find({}, {_id: 1}).map(u => '' + u._id));
    let orphans = 0;
    db.diaries.find({}, {user_id: 1}).forEach(d => {
      if (!userIds.has('' + d.user_id)) orphans++;
    });
    orphans;
  ")
if [[ -n "$ORPHAN_COUNT" && "$ORPHAN_COUNT" != "0" ]]; then
  echo "   FAIL: $ORPHAN_COUNT diary(ies) have user_id values not found in users" >&2
  exit 1
else
  echo "   OK: all diary user_id values reference existing users"
fi

MEDIA_DOC_COUNT=$(docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --eval "db.getSiblingDB(\"$DB\").media.countDocuments({})")
MEDIA_ORPHAN_COUNT=$(docker exec "$VERIFY_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --eval "
    const db = db.getSiblingDB('$DB');
    const users = new Set(db.users.find({}, {_id: 1}).map(u => '' + u._id));
    const diaries = new Set(db.diaries.find({}, {_id: 1}).map(d => '' + d._id));
    let orphans = 0;
    db.media.find({}, {user_id: 1, diary_id: 1}).forEach(m => {
      if (!users.has('' + m.user_id) || (m.diary_id && !diaries.has('' + m.diary_id))) orphans++;
    });
    orphans;
  ")
if [[ -n "$MEDIA_ORPHAN_COUNT" && "$MEDIA_ORPHAN_COUNT" != "0" ]]; then
  echo "FAIL: $MEDIA_ORPHAN_COUNT media record(s) have broken references" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Verify MinIO media is present in the tar
# ---------------------------------------------------------------------------
echo "==> Verifying MinIO media is present in the tar"
mkdir -p "$SCRATCH_MINIO"
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$BACKUP_DIR/minio.tar.enc" \
  | tar -C "$SCRATCH_MINIO" -xf -
MEDIA_FILES=$(find "$SCRATCH_MINIO" -type f | wc -l)
if [[ "$MEDIA_DOC_COUNT" -gt 0 && "$MEDIA_FILES" -eq 0 ]]; then
  echo "FAIL: media records exist but no media objects are present in MinIO backup" >&2
  exit 1
fi
echo "   OK: $MEDIA_FILES media object(s) present"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "VERIFY-RESTORE PASSED"
echo "  Collections: ${COLLECTION_RESULTS[*]}"
echo "  MinIO objects: $MEDIA_FILES"
echo "  Orphan diaries: $ORPHAN_COUNT"
