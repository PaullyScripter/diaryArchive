#!/usr/bin/env bash
# Authenticated envelope helper for backup artifacts.
# OpenSSL enc does not provide AEAD modes, so backups use encrypt-then-MAC:
# AES-256-CBC/PBKDF2 for confidentiality and a domain-separated HMAC key for
# tamper detection. MACs are verified before decryption.

backup_hmac_key() {
  : "${BACKUP_ENCRYPTION_KEY:?set BACKUP_ENCRYPTION_KEY}"
  printf 'DiaryArchive backup HMAC v1:%s' "$BACKUP_ENCRYPTION_KEY" \
    | openssl dgst -sha256 -binary \
    | od -An -tx1 -v \
    | tr -d ' \n'
}

write_backup_mac() {
  local artifact="$1" mac_file="$2"
  local hmac_key
  hmac_key="$(backup_hmac_key)"
  openssl dgst -sha256 -mac HMAC -macopt "hexkey:$hmac_key" -binary "$artifact" \
    | base64 | tr -d '\n' > "$mac_file"
  chmod 600 "$mac_file"
}

verify_backup_mac() {
  local artifact="$1" mac_file="$2"
  [[ -s "$artifact" && -s "$mac_file" ]] || {
    echo "error: missing backup artifact or MAC: $artifact" >&2
    return 1
  }
  local hmac_key expected actual
  hmac_key="$(backup_hmac_key)"
  expected="$(tr -d ' \r\n' < "$mac_file")"
  actual="$(openssl dgst -sha256 -mac HMAC -macopt "hexkey:$hmac_key" -binary "$artifact" | base64 | tr -d '\n')"
  [[ "$expected" == "$actual" ]] || {
    echo "error: backup authentication failed: $artifact" >&2
    return 1
  }
}
