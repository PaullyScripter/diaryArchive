#!/usr/bin/env bash
# One-time production server provisioning (Ubuntu/Debian with systemd).
# Installs Docker + compose plugin, copies certs, seeds .env.production,
# and starts the full stack. Run as root or via sudo.
# Usage: ./docker/scripts/provision.sh
set -euo pipefail

ENV_FILE=".env.production"
DOMAIN="${DOMAIN:-diaryarchive.com}"

echo "==> Installing Docker + compose plugin"
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Ensuring certs directory"
mkdir -p docker/nginx/certs

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE missing. Create it with strong secrets (openssl rand -hex 32) then re-run." >&2
  exit 1
fi

echo "==> Starting stack"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "==> Done. Stack is running."
echo "    Certificates are expected at docker/nginx/certs/{fullchain,privkey}.pem"
echo "    (e.g. obtain via certbot --nginx -d $DOMAIN -d api.$DOMAIN then copy)."
