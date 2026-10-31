#!/usr/bin/env bash
# Modern backup path using age's authenticated encryption.
#
# This script intentionally uses a public recipient file for encryption. The
# corresponding identity stays outside the application host (or in a KMS/HSM
# integration) and is required only for restore. Existing backup.sh archives
# remain supported for migration; setting BACKUP_AGE_RECIPIENT_FILE makes
# backup.sh delegate here automatically.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKUP_ROOT="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
MONGO_CONTAINER="${MONGO_CONTAINER:-diaryarchive-mongodb-1}"
MINIO_CONTAINER="${MINIO_CONTAINER:-diaryarchive-minio-1}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a
fi

command -v age >/dev/null 2>&1 || {
  echo "error: age is required for modern backups; install it from age-encryption.org" >&2
  exit 1
}
: "${BACKUP_AGE_RECIPIENT_FILE:?set BACKUP_AGE_RECIPIENT_FILE to an age recipient file}"
[[ -s "$BACKUP_AGE_RECIPIENT_FILE" ]] || {
  echo "error: age recipient file is missing or empty" >&2
  exit 1
}

MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "==> Backing up MongoDB with age -> $BACKUP_DIR/mongo.archive.age"
docker exec "$MONGO_CONTAINER" mongodump \
  --authenticationDatabase=admin \
  -u "$MONGO_USER" \
  -p "$MONGO_PASS" \
  --archive \
  | age --encrypt --recipients-file "$BACKUP_AGE_RECIPIENT_FILE" \
      --output "$BACKUP_DIR/mongo.archive.age"

echo "==> Backing up MinIO with age -> $BACKUP_DIR/minio.tar.age"
docker exec "$MINIO_CONTAINER" tar -C /data -cf - . \
  | age --encrypt --recipients-file "$BACKUP_AGE_RECIPIENT_FILE" \
      --output "$BACKUP_DIR/minio.tar.age"

for artifact in "$BACKUP_DIR/mongo.archive.age" "$BACKUP_DIR/minio.tar.age"; do
  [[ -s "$artifact" ]] || {
    echo "error: backup artifact is missing or empty: $artifact" >&2
    exit 1
  }
done

sha256sum "$BACKUP_DIR"/*.age > "$BACKUP_DIR/checksums.sha256"
chmod 600 "$BACKUP_DIR/checksums.sha256"
printf '%s\n' "$STAMP" > "$BACKUP_DIR/backup-timestamp.txt"
chmod 600 "$BACKUP_DIR/backup-timestamp.txt"

BACKUP_REMOTE="${BACKUP_REMOTE:-}"
BACKUP_REMOTE_PATH="${BACKUP_REMOTE_PATH:-diaryarchive}"
if [[ -n "$BACKUP_REMOTE" ]]; then
  command -v rclone >/dev/null 2>&1 || {
    echo "error: BACKUP_REMOTE is set but rclone is not installed" >&2
    exit 1
  }
  echo "==> Uploading encrypted backup to $BACKUP_REMOTE/$BACKUP_REMOTE_PATH/$STAMP"
  rclone copy "$BACKUP_DIR" "$BACKUP_REMOTE/$BACKUP_REMOTE_PATH/$STAMP" --immutable
else
  echo "==> No BACKUP_REMOTE configured; skipping off-site upload."
fi

# Keep the same minimum-period retention policy as backup.sh. Never remove
# the newest backup, even when an operator sets an unexpectedly small count.
RETAIN_DAILY="${BACKUP_RETENTION_DAILY:-14}"
RETAIN_WEEKLY="${BACKUP_RETENTION_WEEKLY:-8}"
RETAIN_MONTHLY="${BACKUP_RETENTION_MONTHLY:-6}"
mapfile -t BACKUPS < <(
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d \
    -regextype posix-extended -regex '.*/20[0-9]{6}-[0-9]{6}' \
    -printf '%f\n' | sort -r
)
declare -A KEEP_BACKUPS=()
[[ "${#BACKUPS[@]}" -gt 0 ]] && KEEP_BACKUPS["${BACKUPS[0]}"]=1

protect_periods() {
  local keep="$1" format="$2" stamp period count=0
  [[ "$keep" =~ ^[0-9]+$ ]] || { echo "error: invalid retention value: $keep" >&2; exit 1; }
  [[ "$keep" -gt 0 ]] || return
  declare -A seen=()
  for stamp in "${BACKUPS[@]}"; do
    period="$(date -u -d "${stamp:0:8}" "+$format")"
    [[ -n "${seen[$period]+x}" ]] && continue
    seen["$period"]=1
    KEEP_BACKUPS["$stamp"]=1
    count=$((count + 1))
    [[ "$count" -ge "$keep" ]] && break
  done
}

protect_periods "$RETAIN_DAILY" "%Y-%m-%d"
protect_periods "$RETAIN_WEEKLY" "%G-W%V"
protect_periods "$RETAIN_MONTHLY" "%Y-%m"

for stamp in "${BACKUPS[@]}"; do
  [[ -n "${KEEP_BACKUPS[$stamp]+x}" ]] && continue
  target="$BACKUP_ROOT/$stamp"
  case "$target" in
    "$BACKUP_ROOT"/*) rm -rf -- "$target" ;;
    *) echo "error: refusing to remove unexpected path: $target" >&2; exit 1 ;;
  esac
done

echo "DiaryArchive age backup complete: $BACKUP_DIR"
