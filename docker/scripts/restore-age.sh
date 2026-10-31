#!/usr/bin/env bash
# Restore an age-encrypted backup produced by backup-age.sh.
#
# The live restore is destructive and requires explicit confirmation. The
# identity file is read by age and is never printed or placed in an environment
# variable, reducing accidental exposure in process listings and logs.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKUP_DIR="${1:?usage: restore-age.sh <backup_dir>}"
MONGO_CONTAINER="${MONGO_CONTAINER:-diaryarchive-mongodb-1}"
MINIO_CONTAINER="${MINIO_CONTAINER:-diaryarchive-minio-1}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a
fi

command -v age >/dev/null 2>&1 || {
  echo "error: age is required for modern restores" >&2
  exit 1
}
: "${BACKUP_AGE_IDENTITY_FILE:?set BACKUP_AGE_IDENTITY_FILE to an age identity file}"
[[ -s "$BACKUP_AGE_IDENTITY_FILE" ]] || {
  echo "error: age identity file is missing or empty" >&2
  exit 1
}
: "${BACKUP_AGE_RECIPIENT_FILE:?set BACKUP_AGE_RECIPIENT_FILE so the pre-restore snapshot is protected}"
[[ -s "$BACKUP_AGE_RECIPIENT_FILE" ]] || {
  echo "error: age recipient file is missing or empty" >&2
  exit 1
}
MONGO_USER="${MONGO_ROOT_USER:?set MONGO_ROOT_USER}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:?set MONGO_ROOT_PASSWORD}"
DESTRUCTIVE="${CONFIRM_PRODUCTION_RESTORE:-no}"
[[ "$DESTRUCTIVE" == "yes" ]] || {
  echo "Refusing destructive restore: set CONFIRM_PRODUCTION_RESTORE=yes" >&2
  exit 1
}

[[ -s "$BACKUP_DIR/mongo.archive.age" ]] || {
  echo "error: no age-encrypted Mongo archive found" >&2
  exit 1
}
if [[ -f "$BACKUP_DIR/checksums.sha256" ]]; then
  (cd "$BACKUP_DIR" && sha256sum --check checksums.sha256)
fi

SAFETY_DIR="$BACKUP_DIR/pre-restore-snapshot"
mkdir -p "$SAFETY_DIR"
chmod 700 "$SAFETY_DIR"
docker exec "$MONGO_CONTAINER" mongodump \
  --authenticationDatabase=admin -u "$MONGO_USER" -p "$MONGO_PASS" --archive \
  | age --encrypt --recipients-file "$BACKUP_AGE_RECIPIENT_FILE" \
      --output "$SAFETY_DIR/mongo-pre-restore.archive.age"

echo "==> Restoring MongoDB from age archive"
age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" "$BACKUP_DIR/mongo.archive.age" \
  | docker exec -i "$MONGO_CONTAINER" mongorestore \
      --authenticationDatabase=admin -u "$MONGO_USER" -p "$MONGO_PASS" \
      --drop --archive

if [[ -s "$BACKUP_DIR/minio.tar.age" ]]; then
  echo "==> Restoring MinIO from age archive"
  age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" "$BACKUP_DIR/minio.tar.age" \
    | docker exec -i "$MINIO_CONTAINER" tar -C /data -xf -
fi

echo "Restore complete. Rebuild the Meilisearch index from MongoDB and run the post-restore health checks."
echo "Safety snapshot directory: $SAFETY_DIR"
