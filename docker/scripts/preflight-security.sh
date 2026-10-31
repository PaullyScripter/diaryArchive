#!/usr/bin/env bash
# Fail-closed production deployment checks. This reads paths and presence only;
# it never prints secret values.
set -euo pipefail

require_file() {
  local label="$1" path="$2"
  [[ -s "$path" ]] || { echo "FAIL: $label is missing or empty" >&2; exit 1; }
}

: "${METRICS_TOKEN_FILE:?METRICS_TOKEN_FILE must point to the metrics secret}"
: "${BACKUP_AGE_RECIPIENT_FILE:?BACKUP_AGE_RECIPIENT_FILE is required; legacy CBC backups are migration-only}"
require_file "metrics token file" "$METRICS_TOKEN_FILE"
require_file "age recipient file" "$BACKUP_AGE_RECIPIENT_FILE"

if command -v stat >/dev/null 2>&1; then
  metrics_mode="$(stat -c '%a' "$METRICS_TOKEN_FILE" 2>/dev/null || true)"
  if [[ -n "$metrics_mode" && "${metrics_mode: -1}" != "0" ]]; then
    echo "FAIL: metrics token file must not be readable by group/other users" >&2
    exit 1
  fi
fi

for cert in docker/nginx/certs/fullchain.pem docker/nginx/certs/privkey.pem; do
  require_file "TLS certificate/key" "$cert"
done

case "${PUBLIC_APP_URL:-}" in
  https://*) ;;
  *) echo "FAIL: PUBLIC_APP_URL must use https://" >&2; exit 1 ;;
esac

echo "Production security preflight passed (secret values were not printed)."
