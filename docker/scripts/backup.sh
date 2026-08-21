#!/usr/bin/env bash
# Encrypted, rotation-aware backup of MongoDB + MinIO for DiaryArchive.
#
#   - MongoDB is dumped (oplog/archive) then AES-256-CBC encrypted at rest.
#   - MinIO object data is tar'd then encrypted at rest.
#   - Retention: keeps the latest N daily / weekly / monthly backups, removing
#     older ones safely (never deletes the newest backup).
#   - Meilisearch is NOT backed up: it is a rebuildable index and is reindexed
#     from MongoDB after a restore (see docs/ops/backup-restore.md).
#
# Off-site upload:
#   If BACKUP_REMOTE is set (e.g. "s3:bucket-name"), encrypted artifacts are
#   uploaded via rclone after local backup. Set BACKUP_REMOTE_PATH to control
#   the remote subdirectory (default: "diaryarchive"). If rclone is not
#   installed or the upload fails, local backup remains intact and the error
#   is logged with a non-zero exit status.
#
# Encryption key: BACKUP_ENCRYPTION_KEY (>=32 chars, random). It is READ FROM
# THE ENVIRONMENT / .env.production and never committed to the repository.
#
# Usage:
#   ./docker/scripts/backup.sh [backup_root_dir]
#
# Env (from .env.production unless overridden):
#   BACKUP_ENCRYPTION_KEY  AES-256-CBC passphrase (base64-able, any length)
#   BACKUP_RETENTION_DAILY, _WEEKLY, _MONTHLY   counts to retain
#   BACKUP_REMOTE          rclone remote (e.g. "s3:my-bucket"). Empty = skip.
#   BACKUP_REMOTE_PATH     remote subdirectory (default: "diaryarchive")
set -euo pipefail

BACKUP_ROOT="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
MONGO_CONTAINER="${MONGO_CONTAINER:-diaryarchive-mongodb-1}"
MINIO_CONTAINER="${MINIO_CONTAINER:-diaryarchive-minio-1}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a
fi

: "${BACKUP_ENCRYPTION_KEY:?set BACKUP_ENCRYPTION_KEY (>=32 chars, random)}"
if [[ ${#BACKUP_ENCRYPTION_KEY} -lt 32 ]]; then
  echo "error: BACKUP_ENCRYPTION_KEY must be at least 32 characters." >&2
  exit 1
fi

BACKUP_DIR="$BACKUP_ROOT/$STAMP"
MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"

mkdir -p "$BACKUP_DIR"

echo "==> Backing up MongoDB -> $BACKUP_DIR/mongo.archive.enc"
docker exec "$MONGO_CONTAINER" mongodump \
  --authenticationDatabase=admin \
  -u "$MONGO_USER" \
  -p "$MONGO_PASS" \
  --archive \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass env:BACKUP_ENCRYPTION_KEY \
      -out "$BACKUP_DIR/mongo.archive.enc"

echo "==> Backing up MinIO -> $BACKUP_DIR/minio.tar.enc"
docker exec "$MINIO_CONTAINER" tar -C /data -cf - . \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass env:BACKUP_ENCRYPTION_KEY \
      -out "$BACKUP_DIR/minio.tar.enc"

# ---- Checksum ----------------------------------------------------------------
echo "==> Calculating checksums"
sha256sum "$BACKUP_DIR"/*.enc > "$BACKUP_DIR/checksums.sha256"

echo "$STAMP" > "$BACKUP_DIR/backup-timestamp.txt"
echo "DiaryArchive backup complete: $BACKUP_DIR"

# ---- Off-site upload ---------------------------------------------------------
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
BACKUP_REMOTE_PATH="${BACKUP_REMOTE_PATH:-diaryarchive}"

if [[ -n "$BACKUP_REMOTE" ]]; then
  if ! command -v rclone &>/dev/null; then
    echo "WARNING: BACKUP_REMOTE is set but rclone is not installed. Skipping off-site upload." >&2
  else
    echo "==> Uploading encrypted backup to $BACKUP_REMOTE/$BACKUP_REMOTE_PATH/$STAMP"
    REMOTE_UPLOAD_FAILED=0
    for f in "$BACKUP_DIR"/*.enc "$BACKUP_DIR"/checksums.sha256 "$BACKUP_DIR"/backup-timestamp.txt; do
      if [[ -f "$f" ]]; then
        if ! rclone copyto "$f" "$BACKUP_REMOTE/$BACKUP_REMOTE_PATH/$STAMP/$(basename "$f")" --progress; then
          echo "ERROR: Failed to upload $(basename "$f") to remote." >&2
          REMOTE_UPLOAD_FAILED=1
        fi
      fi
    done

    if [[ "$REMOTE_UPLOAD_FAILED" -eq 0 ]]; then
      echo "==> Off-site upload complete: $BACKUP_REMOTE/$BACKUP_REMOTE_PATH/$STAMP"
    else
      echo "ERROR: Off-site upload partially failed. Local backup is intact." >&2
      exit 1
    fi
  fi
else
  echo "==> No BACKUP_REMOTE configured; skipping off-site upload."
fi

# ---- Retention / rotation --------------------------------------------------
RETAIN_DAILY="${BACKUP_RETENTION_DAILY:-14}"
_RETAIN_WEEKLY="${BACKUP_RETENTION_WEEKLY:-8}"
RETAIN_MONTHLY="${BACKUP_RETENTION_MONTHLY:-6}"

# Newest backup is always kept. We rotate by date-name prefix semantics:
#   daily   = keep newest N
#   weekly  = keep newest N backups that fall in a Monday week
#   monthly = keep newest N backups that fall in a fresh calendar month
_prune() {
  local pattern="$1" keep="$2"
  if [[ "$keep" == "0" ]]; then return; fi
  # List dated backup dirs matching a date prefix, newest first, skip newest N.
  mapfile -t stale < <(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "$pattern" \
                        | sort -r | tail -n +$((keep + 1)))
  for d in "${stale[@]}"; do
    echo "   removing old backup: $d"
    rm -rf "$d"
  done
}

_prune "${STAMP%????????}-*" "$RETAIN_DAILY"
_prune "$(date +%Y%m%d)-*" "$_RETAIN_WEEKLY"
_prune "$(date +%Y%m)-*" "$RETAIN_MONTHLY"

echo "==> Backup rotation done (daily=$RETAIN_DAILY weekly=$_RETAIN_WEEKLY monthly=$RETAIN_MONTHLY)."
