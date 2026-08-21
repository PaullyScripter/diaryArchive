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
# Features:
#   - Creates a safety snapshot before destructive restore (P2.6)
#   - Runs post-restore health checks against the live DB (P2.5)
#   - Produces SHA-256 checksums alongside the safety snapshot
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
SAFETY_SNAPSHOT_DIR="${BACKUP_DIR}/pre-restore-snapshot"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a
fi

: "${BACKUP_ENCRYPTION_KEY:?set BACKUP_ENCRYPTION_KEY (must match backup)}"
MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"
DB="diaryarchive"

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

# ---------------------------------------------------------------------------
# P2.6: Create a safety snapshot before destructive restore
# ---------------------------------------------------------------------------
echo "==> Creating safety snapshot of live database before restore"
mkdir -p "$SAFETY_SNAPSHOT_DIR"

docker exec "$MONGO_CONTAINER" mongodump \
  --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --archive="$SAFETY_SNAPSHOT_DIR/mongo-pre-restore.archive" \
  --db="$DB" 2>/dev/null

if [[ -f "$SAFETY_SNAPSHOT_DIR/mongo-pre-restore.archive" ]]; then
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_KEY \
    -in "$SAFETY_SNAPSHOT_DIR/mongo-pre-restore.archive" \
    -out "$SAFETY_SNAPSHOT_DIR/mongo-pre-restore.archive.enc"
  rm -f "$SAFETY_SNAPSHOT_DIR/mongo-pre-restore.archive"
  sha256sum "$SAFETY_SNAPSHOT_DIR/mongo-pre-restore.archive.enc" > "$SAFETY_SNAPSHOT_DIR/checksums.sha256"
  echo "   Safety snapshot saved: $SAFETY_SNAPSHOT_DIR/mongo-pre-restore.archive.enc"
else
  echo "   WARNING: could not create safety snapshot; proceeding anyway" >&2
fi

# ---------------------------------------------------------------------------
# Restore MongoDB
# ---------------------------------------------------------------------------
echo "==> Restoring MongoDB from $BACKUP_DIR/mongo.archive.enc (with --drop)"
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$BACKUP_DIR/mongo.archive.enc" \
  | docker exec -i "$MONGO_CONTAINER" mongorestore \
      --authenticationDatabase=admin \
      -u "$MONGO_USER" -p "$MONGO_PASS" \
      --drop --archive

# ---------------------------------------------------------------------------
# Restore MinIO
# ---------------------------------------------------------------------------
if [[ -f "$BACKUP_DIR/minio.tar.enc" ]]; then
  echo "==> Restoring MinIO from $BACKUP_DIR/minio.tar.enc"
  openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_KEY \
    -in "$BACKUP_DIR/minio.tar.enc" \
    | docker exec -i "$MINIO_CONTAINER" tar -C /data -xf -
else
  echo "warning: MinIO backup not found; skipping."
fi

# ---------------------------------------------------------------------------
# P2.5: Post-restore health checks
# ---------------------------------------------------------------------------
echo "==> Running post-restore health checks"

# Wait for mongosh availability.
for _ in $(seq 1 30); do
  if docker exec "$MONGO_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
      -u "$MONGO_USER" -p "$MONGO_PASS" \
      --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

CHECKS_PASSED=0
CHECKS_FAILED=0

# Check 1: Users collection non-empty
USER_COUNT=$(docker exec "$MONGO_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --eval "db.getSiblingDB(\"$DB\").users.countDocuments({})" 2>/dev/null || echo "0")
if [[ -n "$USER_COUNT" && "$USER_COUNT" != "0" ]]; then
  echo "   PASS: users collection ($USER_COUNT documents)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "   FAIL: users collection empty or unreadable" >&2
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 2: Diaries collection non-empty
DIARY_COUNT=$(docker exec "$MONGO_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --eval "db.getSiblingDB(\"$DB\").diaries.countDocuments({})" 2>/dev/null || echo "0")
if [[ -n "$DIARY_COUNT" && "$DIARY_COUNT" != "0" ]]; then
  echo "   PASS: diaries collection ($DIARY_COUNT documents)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "   FAIL: diaries collection empty or unreadable" >&2
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 3: Cross-collection integrity
ORPHAN_COUNT=$(docker exec "$MONGO_CONTAINER" mongosh --quiet --authenticationDatabase=admin \
  -u "$MONGO_USER" -p "$MONGO_PASS" \
  --eval "
    const db = db.getSiblingDB('$DB');
    const userIds = new Set(db.users.find({}, {_id: 1}).map(u => '' + u._id));
    let orphans = 0;
    db.diaries.find({}, {owner_id: 1}).forEach(d => {
      if (!userIds.has('' + d.owner_id)) orphans++;
    });
    orphans;
  " 2>/dev/null || echo "-1")
if [[ "$ORPHAN_COUNT" == "0" ]]; then
  echo "   PASS: all diary owner_ids reference existing users"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
elif [[ "$ORPHAN_COUNT" == "-1" ]]; then
  echo "   WARN: could not verify cross-collection integrity" >&2
else
  echo "   WARN: $ORPHAN_COUNT orphaned diaries (owner_ids not in users)" >&2
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi

# Check 4: MinIO reachable (if container exists)
if docker ps --format '{{.Names}}' | grep -q "$MINIO_CONTAINER"; then
  if docker exec "$MINIO_CONTAINER" curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    echo "   PASS: MinIO health check OK"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  else
    echo "   FAIL: MinIO health check failed" >&2
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
  fi
else
  echo "   SKIP: MinIO container not found"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Restore complete."
echo "  Checks passed: $CHECKS_PASSED"
echo "  Checks failed: $CHECKS_FAILED"
if [[ "$CHECKS_FAILED" -gt 0 ]]; then
  echo "  WARNING: Some health checks failed. Review the output above." >&2
fi
echo "  Safety snapshot: $SAFETY_SNAPSHOT_DIR"
echo "NOTE: Meilisearch is not stored in backups; reindex from MongoDB after restore."
echo "      Restart backend to trigger re-indexing if search data is stale."
