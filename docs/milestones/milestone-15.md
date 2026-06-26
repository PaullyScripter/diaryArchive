# Milestone 15 — Production Deployment

## Overview

**Goal:** DiaryArchive is running in production behind Cloudflare with CI/CD, monitoring, and backups. The application is stable, secure, observable, and ready for real users.

**Purpose:** After 14 milestones of feature development and polish, this milestone transitions the application from development to production. It covers infrastructure provisioning, CI/CD automation, monitoring, backup strategies, load testing, and the final launch sequence.

**Dependencies:** Milestone 14 (Polish & Performance) — all features complete, performance optimized, and accessibility verified.

---

## Architecture Impact

### Backend
- Production Docker Compose with resource limits, restart policies, logging drivers
- MongoDB replica set (3 nodes) for high availability
- Redis persistence (AOF) for cache durability
- SMTP configuration for transactional email
- Health check endpoints enhanced for production monitoring

### Frontend
- Production Next.js build with all optimizations (M14)
- CDN caching via Cloudflare
- Static asset optimization (compression, caching headers)

### Infrastructure
- Production VPS (Linux, Docker, 8GB+ RAM, SSD)
- Cloudflare: DNS, SSL/TLS, DDoS protection, caching rules
- Nginx: reverse proxy, rate limiting, SSL termination, gzip
- GitHub Actions CD: auto-deploy on push to main
- Monitoring stack: health checks, uptime monitoring, alerting
- Logging: centralized log collection (Loki + Grafana)
- Backups: daily encrypted MongoDB dumps stored off-server

### Database
- MongoDB replica set with keyfile authentication
- Oplog sizing for replication lag tolerance
- Backup user with read-only access to all databases

### API
- All endpoints behind Cloudflare proxy
- Rate limiting at both Nginx and application level
- CORS restricted to production domain

### Security
- Cloudflare WAF rules for common attack patterns
- CSP headers from M14 verified in production
- SSL/TLS enforcement (HTTPS redirect)
- Secrets in environment variables (never in code)
- SMTP credentials, MinIO keys, JWT secret, MongoDB passwords all rotated

---

## Features

### F15.1 — Production Server Provisioning (Infrastructure)

**Provision a VPS with:**

| Requirement | Specification |
|-------------|---------------|
| CPU | 4+ vCPUs (Intel/AMD x86_64) |
| RAM | 8 GB minimum, 16 GB recommended |
| Storage | 100 GB SSD (or NVMe) |
| OS | Ubuntu 24.04 LTS |
| Docker | Docker CE 27+ with Docker Compose v2 |
| Network | Public IP, port 80/443 open, SSH on non-standard port |
| Firewall | UFW: allow 22 (custom), 80, 443; deny all else |
| Swap | 2 GB swap file / swap partition |
| Monitoring agent | Prometheus node_exporter installed |

**Provisioning script** (`scripts/provision.sh`):

```bash
#!/bin/bash
set -euo pipefail

# Update system
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 ufw fail2ban unattended-upgrades

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp  # SSH on non-standard port
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Configure fail2ban for SSH
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 2222
maxretry = 5
bantime = 3600
EOF
systemctl restart fail2ban

# Enable unattended security upgrades
dpkg-reconfigure --priority=low unattended-upgrades

# Configure Docker daemon for production
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": { "Hard": 64000, "Name": "nofile", "Soft": 64000 }
  }
}
EOF
systemctl restart docker

# Create docker network
docker network create diaryarchive-network

# Create directory structure
mkdir -p /opt/diaryarchive/{data,logs,backups,config}
mkdir -p /opt/diaryarchive/data/{mongodb,redis,minio,meilisearch}
```

### F15.2 — Cloudflare Configuration (Infrastructure)

**DNS Configuration:**
```
Type  Name              Content                 Proxy
────  ────────────────  ──────────────────────  ─────
A     @                 <server-ip>             Proxied (orange cloud)
A     api               <server-ip>             Proxied (orange cloud)
CNAME www               diaryarchive.com        Proxied
```

**SSL/TLS Settings:**
- SSL/TLS encryption mode: **Full (Strict)** — requires valid origin certificate
- Always Use HTTPS: **On**
- Minimum TLS Version: **1.2**
- Automatic HTTPS Rewrites: **On**
- Certificate: Cloudflare Origin CA certificate installed on Nginx

**Security Settings:**
- WAF: Managed Ruleset — OWASP Core Ruleset (Paranoia Level 2)
- Bot Fight Mode: **On** (or Super Bot Fight Mode)
- Rate Limiting:
  - `/api/v1/auth/login`: 100 requests/10s per IP
  - `/api/v1/auth/register`: 20 requests/10s per IP
  - `/api/v1/media/upload`: 30 requests/10s per IP
  - General API: 1000 requests/10s per IP

**Caching Rules:**
```
Static assets (js, css, png, webp, jpg, svg, woff2):
  Cache Level: Standard
  Edge TTL: 30 days
  Browser TTL: 1 year

API responses:
  Cache Level: Bypass (dynamic content)

Next.js pages:
  Cache Level: Standard
  Edge TTL: 0 (browser caching only through Cache-Control headers)
```

**Page Rules:**
```
diaryarchive.com/*.webp → Cache Level: Standard, Edge TTL: 30d
diaryarchive.com/_next/static/* → Cache Level: Standard, Edge TTL: 365d
diaryarchive.com/api/* → Cache Level: Bypass, Security Level: High
```

### F15.3 — Nginx Configuration (Infrastructure)

**File:** `docker/nginx/nginx.conf`

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:3000;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=register:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=15r/m;
limit_req_zone $binary_remote_addr zone=static:10m rate=500r/s;

# Security limits
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_conn addr 20;

server {
    listen 80;
    server_name diaryarchive.com api.diaryarchive.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.diaryarchive.com;

    ssl_certificate /etc/nginx/ssl/origin-cert.pem;
    ssl_certificate_key /etc/nginx/ssl/origin-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # CORS
    add_header Access-Control-Allow-Origin "https://diaryarchive.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Request-ID" always;
    add_header Access-Control-Allow-Credentials "true" always;

    location / {
        limit_req zone=api burst=200 nodelay;
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;

        # Don't buffer large uploads (MinIO)
        proxy_request_buffering off;
        client_max_body_size 25M;
    }

    # Health check - no rate limit
    location /api/v1/health {
        limit_req off;
        proxy_pass http://backend;
    }

    # Media access — bypass backend for cached media from MinIO
    location /media/ {
        proxy_pass http://minio:9000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering on;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    gzip on;
    gzip_types application/json application/javascript text/css text/plain image/svg+xml;
    gzip_min_length 1000;
    gzip_comp_level 5;
    gzip_vary on;
}

server {
    listen 443 ssl http2;
    server_name diaryarchive.com www.diaryarchive.com;

    ssl_certificate /etc/nginx/ssl/origin-cert.pem;
    ssl_certificate_key /etc/nginx/ssl/origin-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static assets — long cache
    location /_next/static/ {
        proxy_pass http://frontend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # User-uploaded images (served via signed URLs)
    location /media-proxy/ {
        limit_req zone=api burst=100;
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }
}
```

### F15.4 — Production Docker Compose (Infrastructure)

**File:** `docker-compose.prod.yml`

```yaml
version: "3.9"

services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    expose:
      - "8000"
    environment:
      - DATABASE_URL=mongodb://mongodb-primary:27017,mongodb-secondary:27017/?replicaSet=rs0
      - REDIS_URL=redis://redis:6379/0
      - MINIO_ENDPOINT=minio:9000
      - MEILI_HTTP_ADDR=http://meilisearch:7700
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
      - SECRET_KEY=${SECRET_KEY}
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - CORS_ORIGINS=https://diaryarchive.com
      - LOG_LEVEL=INFO
    env_file:
      - .env.production
    depends_on:
      mongodb-primary:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=https://api.diaryarchive.com
    expose:
      - "3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.diaryarchive.com
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  mongodb-primary:
    image: mongo:7.0
    command: >
      mongod --replSet rs0
              --keyFile /etc/mongo-keyfile
              --auth
              --bind_ip_all
    volumes:
      - mongodb_primary_data:/data/db
      - ./docker/mongodb/keyfile:/etc/mongo-keyfile:ro
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
    expose:
      - "27017"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
    healthcheck:
      test: echo "db.runCommand('ping').ok" | mongosh --quiet
      interval: 30s
      timeout: 10s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  mongodb-secondary:
    image: mongo:7.0
    command: >
      mongod --replSet rs0
              --keyFile /etc/mongo-keyfile
              --auth
              --bind_ip_all
    volumes:
      - mongodb_secondary_data:/data/db
      - ./docker/mongodb/keyfile:/etc/mongo-keyfile:ro
    expose:
      - "27017"
    depends_on:
      - mongodb-primary
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.75"
          memory: 768M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  mongodb-arbiter:
    image: mongo:7.0
    command: >
      mongod --replSet rs0
              --keyFile /etc/mongo-keyfile
              --auth
              --bind_ip_all
    volumes:
      - ./docker/mongodb/keyfile:/etc/mongo-keyfile:ro
    expose:
      - "27017"
    depends_on:
      - mongodb-primary
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.25"
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7.2-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    expose:
      - "6379"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    expose:
      - "9000"
      - "9001"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  meilisearch:
    image: getmeili/meilisearch:v1.8
    command: meilisearch --master-key ${MEILI_MASTER_KEY} --env production
    volumes:
      - meilisearch_data:/meili_data
    expose:
      - "7700"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  mongodb_primary_data:
  mongodb_secondary_data:
  redis_data:
  minio_data:
  meilisearch_data:
  nginx_logs:
```

### F15.5 — Environment Variables Configuration (Infrastructure)

**File:** `.env.production`

```bash
# Django / FastAPI
SECRET_KEY=<random-64-char-hex>
CORS_ORIGINS=https://diaryarchive.com
LOG_LEVEL=INFO

# MongoDB
MONGO_ROOT_USER=diaryarchive_admin
MONGO_ROOT_PASSWORD=<random-32-char>
MONGO_APP_USER=diaryarchive_app
MONGO_APP_PASSWORD=<random-32-char>
DATABASE_URL=mongodb://diaryarchive_app:<password>@mongodb-primary:27017,mongodb-secondary:27017/diaryarchive?replicaSet=rs0&authSource=admin

# Redis
REDIS_PASSWORD=<random-32-char>
REDIS_URL=redis://:<password>@redis:6379/0

# MinIO
MINIO_ACCESS_KEY=diaryarchive
MINIO_SECRET_KEY=<random-40-char>
MINIO_SECURE=false  # internal Docker network, no TLS needed
MINIO_BUCKET_PUBLIC=media-public
MINIO_BUCKET_PRIVATE=media-private

# Meilisearch
MEILI_MASTER_KEY=<random-32-char>
MEILI_HTTP_ADDR=http://meilisearch:7700

# SMTP (transactional email)
SMTP_HOST=smtp.sendgrid.net  # or Mailgun, Postmark, etc.
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<smtp-api-key>
SMTP_FROM=noreply@diaryarchive.com

# Next.js
NEXT_PUBLIC_API_URL=https://api.diaryarchive.com
```

All secrets generated with: `openssl rand -hex 32` or equivalent.

Secrets stored in:
- `.env.production` on the server (root-only read permissions, 600)
- 1Password / Bitwarden for team access
- GitHub Actions secrets for CI/CD

### F15.6 — MongoDB Replica Set Setup (Infrastructure)

**Initiate replica set** (run once on primary):

```bash
docker exec -it diaryarchive-mongodb-primary-1 mongosh -u diaryarchive_admin -p <password>

rs.initiate({
  _id: "rs0",
  version: 1,
  members: [
    { _id: 0, host: "mongodb-primary:27017", priority: 2 },
    { _id: 1, host: "mongodb-secondary:27017", priority: 1 },
    { _id: 2, host: "mongodb-arbiter:27017", arbiterOnly: true }
  ]
})

# Create application user (readWrite on diaryarchive)
use diaryarchive
db.createUser({
  user: "diaryarchive_app",
  pwd: "<password>",
  roles: [{ role: "readWrite", db: "diaryarchive" }]
})

# Create backup user (read any database)
db.getSiblingDB("admin").createUser({
  user: "diaryarchive_backup",
  pwd: "<password>",
  roles: [{ role: "readAnyDatabase", db: "admin" }]
})
```

**Keyfile generation:**

```bash
openssl rand -base64 756 > docker/mongodb/keyfile
chmod 400 docker/mongodb/keyfile
chown 999:999 docker/mongodb/keyfile  # mongodb user UID
```

### F15.7 — Redis Persistence Configuration (Infrastructure)

Redis configured with AOF persistence (append-only file):

```yaml
redis:
  command: >
    redis-server --appendonly yes
                 --appendfsync everysec
                 --auto-aof-rewrite-percentage 100
                 --auto-aof-rewrite-min-size 64mb
                 --save 900 1
                 --save 300 10
                 --save 60 10000
                 --requirepass ${REDIS_PASSWORD}
```

- AOF: appendfsync everysec (balance between durability and performance)
- RDB snapshots as fallback (every 15 min if 1 key changed, etc.)
- Maxmemory policy: `allkeys-lru` (cache use case; no strict durability needed)
- Maxmemory: 128MB (production; adjust based on usage)

### F15.8 — MinIO Production Configuration (Infrastructure)

For production, two options:

**Option A: MinIO standalone (recommended for MVP)**
- Single MinIO container with persistent volume
- `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` configured
- Lifecycle policy: auto-delete objects in `media-private` bucket after 365 days
- Bucket versioning enabled for `media-public` (protect against accidental deletion)

**Option B: Cloudflare R2 (for scalability)**
- R2 is S3-compatible, no egress fees
- Swap MinIO connection settings to R2 endpoint
- R2 provides 99.99% durability, global CDN delivery
- Migration script: copy all objects from MinIO to R2

For MVP, Option A with daily backups to R2 is the recommended path.

### F15.9 — GitHub Actions CD Pipeline (Infrastructure)

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

concurrency:
  group: production
  cancel-in-progress: false

jobs:
  test:
    name: Test & Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Backend tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest tests/ --cov --cov-report=xml -v

      - name: Frontend build check
        run: |
          cd frontend
          npm ci
          npm run build

      - name: Lint check
        run: |
          cd backend && ruff check .
          cd ../frontend && npm run lint

      - name: Type check
        run: |
          cd backend && mypy app/
          cd ../frontend && npx tsc --noEmit

  deploy:
    name: Deploy to VPS
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Copy files via rsync
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avz --delete --exclude="node_modules" --exclude="__pycache__" --exclude=".env.production" --exclude="*.log"
          remote_path: /opt/diaryarchive/
          remote_host: ${{ secrets.DEPLOY_HOST }}
          remote_user: ${{ secrets.DEPLOY_USER }}
          remote_key: ${{ secrets.DEPLOY_KEY }}
          remote_port: ${{ secrets.DEPLOY_PORT }}

      - name: Deploy with Docker Compose
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          port: ${{ secrets.DEPLOY_PORT }}
          script: |
            cd /opt/diaryarchive
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
            docker image prune -f

      - name: Health check
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          port: ${{ secrets.DEPLOY_PORT }}
          script: |
            for i in {1..30}; do
              sleep 5
              STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.diaryarchive.com/api/v1/health)
              if [ "$STATUS" = "200" ]; then
                echo "Deploy successful!"
                exit 0
              fi
            done
            echo "Health check failed after 150s"
            exit 1

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1.25.0
        with:
          payload: |
            { "text": "Deployment to production failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### F15.10 — Monitoring Setup (Infrastructure)

**Health check endpoint** (`GET /api/v1/health`):

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "commit_hash": "a1b2c3d4",
  "deployed_at": "2026-06-25T12:00:00Z",
  "checks": {
    "mongodb": { "status": "ok", "replica_set": "rs0", "primary": "mongodb-primary:27017" },
    "redis": { "status": "ok", "used_memory_mb": 12.5 },
    "minio": { "status": "ok", "buckets": ["media-public", "media-private"] },
    "meilisearch": { "status": "ok", "indexes": ["public_diaries"] }
  },
  "uptime_seconds": 86400
}
```

**Uptime monitoring** (UptimeRobot / Better Uptime / Checkly):

| Monitor | Type | Interval | Alert |
|---------|------|----------|-------|
| Homepage | HTTPS GET https://diaryarchive.com | 5 min | Email + Slack |
| API Health | HTTPS GET https://api.diaryarchive.com/api/v1/health | 5 min | Email + Slack |
| SSL Expiry | Certificate check | Daily | Email + Slack (14d before expiry) |
| Login Flow | E2E test (Playwright) | 15 min | Slack |

**Prometheus + Grafana (optional for MVP, recommended for scale):**

Docker Compose services:
- `prometheus`: scrape metrics from backend (if instrumented), node_exporter, cAdvisor
- `grafana`: dashboards for request rate, error rate, latency, resource usage
- `node_exporter`: system metrics (CPU, memory, disk, network)
- `cAdvisor`: container metrics (per-container CPU, memory, network)

**Alerting thresholds:**
- Pager (critical): 5xx rate > 5% over 5 minutes
- Pager (critical): Service unavailable for >2 minutes
- Warning: 90th percentile latency > 1s
- Warning: Disk usage > 80%
- Warning: Memory usage > 80%
- Info: New deployment started

### F15.11 — Backup Setup (Infrastructure)

**File:** `scripts/backup.sh`

```bash
#!/bin/bash
set -euo pipefail

DATE=$(date +%Y-%m-%d-%H%M%S)
BACKUP_DIR="/opt/diaryarchive/backups"
DB_NAME="diaryarchive"
S3_BUCKET="s3://diaryarchive-backups"
ENCRYPTION_KEY="/opt/diaryarchive/config/backup-key.gpg"

echo "[$(date)] Starting backup: $DATE"

# MongoDB dump (secondary preferred to avoid primary load)
echo "  -> Dumping MongoDB..."
mongodump \
  --host "mongodb-secondary:27017" \
  --username "diaryarchive_backup" \
  --password "$MONGO_BACKUP_PASSWORD" \
  --authenticationDatabase admin \
  --db "$DB_NAME" \
  --out "$BACKUP_DIR/mongodb-$DATE" \
  --gzip \
  --numParallelCollections 4 \
  --quiet

# Encrypt
echo "  -> Encrypting..."
tar czf "$BACKUP_DIR/mongodb-$DATE.tar.gz" -C "$BACKUP_DIR" "mongodb-$DATE"
gpg --batch --yes --encrypt \
  --recipient "diaryarchive-backup" \
  --output "$BACKUP_DIR/mongodb-$DATE.tar.gz.gpg" \
  "$BACKUP_DIR/mongodb-$DATE.tar.gz"

# Upload to off-server storage (Cloudflare R2 / S3)
echo "  -> Uploading to R2..."
aws s3 cp "$BACKUP_DIR/mongodb-$DATE.tar.gz.gpg" "$S3_BUCKET/mongodb/$DATE.tar.gz.gpg" \
  --endpoint-url "$R2_ENDPOINT" \
  --quiet

# Cleanup local files (keep last 3 backups locally)
echo "  -> Cleaning up..."
rm -rf "$BACKUP_DIR/mongodb-$DATE" "$BACKUP_DIR/mongodb-$DATE.tar.gz"
ls -1t "$BACKUP_DIR/mongodb-*.tar.gz.gpg" | tail -n +4 | xargs -r rm

# Verify backup
echo "  -> Verifying..."
aws s3 ls "$S3_BUCKET/mongodb/$DATE.tar.gz.gpg" \
  --endpoint-url "$R2_ENDPOINT" \
  --quiet || { echo "Backup upload FAILED"; exit 1; }

echo "[$(date)] Backup complete: $DATE"
echo "  -> File: $S3_BUCKET/mongodb/$DATE.tar.gz.gpg"
```

**Cron schedule** (`/etc/cron.d/diaryarchive-backup`):
```
0 3 * * * root /opt/diaryarchive/scripts/backup.sh >> /var/log/diaryarchive/backup.log 2>&1
```

**Backup retention:**
- Local: 3 most recent backups
- Remote (R2/S3): 30 daily backups, 12 monthly backups, 3 yearly backups
- Lifecycle policy on R2 bucket: auto-delete objects older than 365 days

**Restore procedure:**
```bash
# Download encrypted backup
aws s3 cp s3://diaryarchive-backups/mongodb/2026-06-25-030000.tar.gz.gpg ./restore/
# Decrypt
gpg --decrypt ./restore/2026-06-25-030000.tar.gz.gpg > ./restore/backup.tar.gz
# Extract
tar xzf ./restore/backup.tar.gz -C ./restore/
# Restore
mongorestore --drop --gzip ./restore/mongodb-2026-06-25-030000/
```

### F15.12 — Centralized Logging Setup (Infrastructure)

**Option: Loki + Promtail + Grafana** (lightweight, no Elasticsearch overhead)

Docker Compose service:

```yaml
loki:
  image: grafana/loki:3.0
  ports:
    - "3100:3100"
  volumes:
    - ./docker/loki/config.yaml:/etc/loki/config.yaml:ro
    - loki_data:/loki
  command: -config.file=/etc/loki/config.yaml
  restart: unless-stopped

promtail:
  image: grafana/promtail:3.0
  volumes:
    - /var/log:/var/log:ro
    - /var/lib/docker/containers:/var/lib/docker/containers:ro
    - ./docker/promtail/config.yaml:/etc/promtail/config.yaml:ro
  command: -config.file=/etc/promtail/config.yaml
  restart: unless-stopped

grafana:
  image: grafana/grafana:11.0
  ports:
    - "3001:3000"
  volumes:
    - grafana_data:/var/lib/grafana
    - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    - ./docker/grafana/datasources:/etc/grafana/provisioning/datasources:ro
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    - GF_INSTALL_PLUGINS=grafana-piechart-panel
  restart: unless-stopped
```

Grafana dashboards:
- **Request Dashboard**: request rate, error rate, latency (p50/p95/p99) per endpoint
- **System Dashboard**: CPU, memory, disk, network per container
- **MongoDB Dashboard**: connections, operations, replication lag
- **Redis Dashboard**: hit rate, memory usage, connected clients
- **Deployment Dashboard**: deployment frequency, success rate, rollback rate

### F15.13 — SMTP Configuration (Infrastructure)

**Transactional email provider:** SendGrid (or Mailgun, Postmark, AWS SES)

Setup:
1. Create SendGrid account, verify sender domain (`diaryarchive.com`)
2. Create API key with "Mail Send" permission
3. Configure SPF, DKIM, DMARC DNS records for `diaryarchive.com`

**Email templates:**

| Template | Trigger | Variables |
|----------|---------|-----------|
| Password Reset | Request password reset | `{reset_link}`, `{username}` |
| Email Verification | Add/change email | `{verify_link}`, `{username}` |
| Welcome | Account registration | `{username}` |

**SMTP configuration in FastAPI:**

```python
# backend/app/services/email_service.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

async def send_email(to: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
```

### F15.14 — Security Audit (Infrastructure)

**Pre-launch security checklist:**

| Check | Tool | Pass Criteria |
|-------|------|---------------|
| SSL/TLS configuration | ssllabs.com/ssltest | A+ rating |
| HTTP security headers | securityheaders.com | A+ rating |
| CSP evaluation | csp-evaluator.withgoogle.com | No warnings |
| Open ports | nmap | Only 22, 80, 443 open |
| SSH hardening | Manual | Key-only auth, non-standard port, fail2ban |
| Docker security | docker-bench-security | No critical failures |
| Secret scanning | gitleaks | No secrets in repo |
| Dependency audit | npm audit, pip audit | No critical vulnerabilities |
| XSS testing | Manual / ZAP | No XSS vectors exploitable |
| SQL injection | N/A (MongoDB) | No injection via operators |
| Rate limit testing | Manual / k6 | Limits enforced as configured |
| CORS testing | curl | Only production domain allowed |
| File upload testing | Manual | Magic bytes validated, no shell upload |
| Authentication testing | Manual | No auth bypass, refresh rotation works |
| Session management | Manual | Logout invalidates, tokens expire |
| Backups test restore | Manual | Restore from backup works end-to-end |

### F15.15 — Load Testing (Infrastructure)

**Tool:** k6 (or Artillery)

**Test scenarios:**

```javascript
// scripts/loadtest.js
import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 50 },   // Ramp up to 50 users
    { duration: "5m", target: 100 },  // Ramp to 100 users
    { duration: "3m", target: 200 },  // Stress test to 200 users
    { duration: "2m", target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],  // 95% of requests <500ms
    http_req_failed: ["rate<0.01"],    // <1% failure rate
  },
};

export default function () {
  // Test homepage
  const res1 = http.get("https://diaryarchive.com");
  check(res1, { "homepage status 200": (r) => r.status === 200 });

  // Test public feed
  const res2 = http.get("https://api.diaryarchive.com/api/v1/diaries?page=1&per_page=20");
  check(res2, { "feed status 200": (r) => r.status === 200 });

  sleep(1);
}
```

**Targets:**
- Concurrent users: 200 (10x expected initial traffic)
- P95 response time: <500ms for API, <2s for pages
- Error rate: <1%
- Throughput: 500 req/s sustained

**Infrastructure scaling:**
- If P95 > 500ms: add Redis caching for more endpoints
- If throughput < 500 req/s: increase backend `deploy.resources.limits.cpus` to 2
- If CPU > 80% on backend: add a second backend instance behind Nginx load balancing

### F15.16 — Soft Launch (Operations)

**Phase 1 — Internal testing (1-2 days):**
- Deploy to production behind Cloudflare
- Give access to 5-10 internal testers
- Verify all workflows: register, create diary (public/private), upload media, comment, like, search, settings
- Monitor error rates, response times, resource usage
- Fix any production-specific issues

**Phase 2 — Closed beta (3-5 days):**
- Open registration with invite-only code
- Limit to 100 users
- Monitor MongoDB query patterns, disk usage, memory usage
- Collect feedback on UX, performance, bugs
- Tune rate limits and caching based on real traffic

**Phase 3 — Soft launch (3-7 days):**
- Remove invite requirement
- Announce on social media / relevant communities
- Monitor: error rates, response times, resource usage, backup success
- Keep rollback plan ready (redeploy previous Docker images)

### F15.17 — Full Launch (Operations)

**Launch checklist:**
1. All tests pass (backend + frontend + load test)
2. Security audit passes
3. SSL certificate valid
4. DNS propagated
5. Backups running and verified
6. Monitoring alerts configured
7. Rollback plan documented
8. Support contact established
9. Status page configured (e.g., status.diaryarchive.com)
10. Domain DKIM/SPF/DMARC configured for email deliverability

**Post-launch monitoring (first 48 hours):**
- Real-time error monitoring (Grafana/DataDog/Sentry)
- Response time dashboards — watch for degradation
- Database connection pool — watch for exhaustion
- Disk usage — watch for unexpected growth
- Backup verification — confirm first 3 backups succeed
- User feedback collection — inline feedback widget

---

## File Structure

### New Files (Infrastructure)
```
docker/
├── nginx/
│   ├── nginx.conf                     # Production Nginx config (reverse proxy, SSL, rate limiting)
│   └── ssl/                           # Cloudflare origin certificates (not committed — .gitignored)
│       ├── origin-cert.pem
│       └── origin-key.pem
├── mongodb/
│   └── keyfile                        # Replica set authentication key (not committed — .gitignored)
├── loki/
│   └── config.yaml                    # Loki log aggregation config
├── promtail/
│   └── config.yaml                    # Promtail log shipping config
├── grafana/
│   ├── datasources/
│   │   └── datasources.yaml           # Prometheus + Loki datasources
│   └── dashboards/
│       ├── request-dashboard.json     # Request rate/latency/error dashboard
│       ├── system-dashboard.json      # System resource dashboard
│       └── mongodb-dashboard.json     # MongoDB performance dashboard
└── prometheus/
    └── prometheus.yml                 # Scrape config
scripts/
├── backup.sh                          # Daily encrypted MongoDB backup
├── restore.sh                         # Restore from backup
├── provision.sh                       # Server provisioning script
└── loadtest.js                        # k6 load test script
.github/workflows/
└── deploy.yml                         # CD pipeline (test → build → deploy → health check)
docker-compose.prod.yml                # Production Docker Compose (already exists — updated)
.env.production                        # Production environment variables (not committed)
```

### Modified Files
```
docker-compose.prod.yml               # Production-grade resource limits, health checks, logging drivers
README.md                             # Production setup instructions, architecture overview
docs/deployment.md                    # New document: deployment guide, rollback procedures
docs/monitoring.md                    # New document: monitoring setup, alerting rules
docs/security.md                      # Update with production security configuration
```

---

## Database Changes

No schema changes. Production database is bootstrapped from the existing indexes defined in M02.

### Production-Specific Changes
- MongoDB replica set initialization (rs.initiate)
- Application user creation (readWrite on diaryarchive)
- Backup user creation (readAnyDatabase on admin)
- Replica set keyfile authentication

---

## API Endpoints

No new endpoints. Health check endpoint (`GET /api/v1/health`) enhanced with replica set status and uptime.

---

## Frontend

No frontend changes in this milestone. The production build of the existing Next.js application is served with:
- All M14 optimizations active (code splitting, lazy loading, image optimization, CSP headers)
- `next.config.ts` production environment overrides
- CDN caching via Cloudflare for static assets
- `NEXT_PUBLIC_API_URL` set to `https://api.diaryarchive.com`

---

## Backend

No new backend features. The following are configured for production:
- `LOG_LEVEL=INFO` (not DEBUG)
- Structured JSON logging via structlog
- CORS origins restricted to `https://diaryarchive.com`
- Rate limits finalized (see M14)
- Redis connection string with password
- MongoDB connection string with replica set and authentication
- MinIO/SMTP/Meilisearch connection strings with authentication
- Health check enhanced with replica set status

---

## Infrastructure

### Docker Compose Resource Limits

| Service | CPU Limit | Memory Limit | Restart Policy | Health Check |
|---------|-----------|-------------|----------------|--------------|
| nginx | 0.5 | 256M | unless-stopped | — (monitored externally) |
| backend | 1.0 | 512M | unless-stopped | GET /api/v1/health |
| frontend | 0.5 | 256M | unless-stopped | HTTP 200 on / |
| mongodb-primary | 1.0 | 1G | unless-stopped | mongosh ping |
| mongodb-secondary | 0.75 | 768M | unless-stopped | mongosh ping |
| mongodb-arbiter | 0.25 | 256M | unless-stopped | mongosh ping |
| redis | 0.5 | 256M | unless-stopped | redis-cli ping |
| minio | 0.5 | 512M | unless-stopped | /minio/health/live |
| meilisearch | 0.5 | 256M | unless-stopped | /health |
| loki | 0.5 | 512M | unless-stopped | — |
| promtail | 0.25 | 128M | unless-stopped | — |
| grafana | 0.5 | 256M | unless-stopped | — |

### Network Architecture

```
Internet
    │
    ▼
Cloudflare (DNS, SSL, DDoS, WAF, Caching)
    │
    ▼
VPS (Ubuntu 24.04, UFW: 80, 443, 2222)
    │
    ▼
Nginx (reverse proxy, rate limiting, SSL termination, gzip)
    ├── api.diaryarchive.com → backend:8000
    └── diaryarchive.com    → frontend:3000
            │
            ▼
Docker Compose (diaryarchive-network)
    ├── backend     (FastAPI, 1 replica)
    ├── frontend    (Next.js, 1 replica)
    ├── mongodb     (3-node replica set — primary, secondary, arbiter)
    ├── redis       (AOF persistence)
    ├── minio       (S3-compatible object storage)
    ├── meilisearch (full-text search)
    ├── loki        (log aggregation)
    ├── promtail    (log shipping)
    └── grafana     (dashboards, alerting)
```

### CD Pipeline

```
GitHub → Push to main
    │
    ▼
GitHub Actions
    ├── lint (ruff, eslint)
    ├── typecheck (mypy, tsc)
    ├── test (pytest, frontend tests)
    └── build (next build)
    │
    ▼
rsync to VPS (/opt/diaryarchive/)
    │
    ▼
docker compose up -d --build
    │
    ▼
Health check (wait for 200 from /api/v1/health)
    │
    ▼
Slack notification (success/failure)
```

---

## Security

### Production Security Measures

| Layer | Measure |
|-------|---------|
| DNS | Cloudflare proxy, DNSSEC enabled |
| Network | UFW (port 22/custom, 80, 443 only), fail2ban |
| TLS | Cloudflare Origin CA, Full Strict, TLS 1.2+ |
| WAF | Cloudflare OWASP Core Ruleset, Bot Fight Mode |
| HTTP | HSTS, CSP, X-Frame-Options, X-Content-Type-Options |
| API | Rate limiting (Nginx + app), CORS restricted |
| Auth | Argon2id, JWT, refresh rotation, short expiry |
| Storage | MongoDB auth, MinIO auth, Redis password |
| Secrets | Environment variables (never in code), restricted file perms |
| Backups | GPG encrypted, stored off-server |
| Monitoring | Anomaly detection via Grafana alerts |

### SSH Hardening
- Port changed from 22 to custom port (2222)
- Password authentication disabled
- Key-only authentication (Ed25519)
- fail2ban: 5 retries → 1-hour ban
- Root login disabled; sudo-only access
- SSH allowed only from trusted IPs (optional)

---

## Performance

### Production Performance Targets

| Metric | Target | Verified |
|--------|--------|----------|
| Lighthouse Performance | ≥90 | M14 |
| Lighthouse Accessibility | ≥95 | M14 |
| API P95 response time | <500ms | Load test |
| Page load (TTFB) | <800ms | Load test |
| Concurrent users | 200 | Load test |
| Sustained throughput | 500 req/s | Load test |
| MongoDB query time | <50ms (p95) | explain() audit |
| Redis cache hit rate | >80% | Monitoring |

### Scaling Plan for Post-Launch

| Trigger | Action |
|---------|--------|
| API P95 > 500ms | Add Redis cache for more endpoints; increase backend CPU limit |
| Backend CPU > 80% | Add second backend container behind Nginx (upstream block) |
| MongoDB CPU > 50% | Add indexes; consider read from secondary; upgrade VPS |
| Disk > 80% | Increase volume size; clean up old backups; archive old logs |
| Concurrent users > 500 | Add second VPS; split services; database sharding |
| Media growth > 50GB | Migrate MinIO to Cloudflare R2 for unlimited storage |

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_health_endpoint` | Unit | Returns 200 with all service status |
| `test_health_replica_set` | Unit | Returns replica set status from MongoDB |
| `test_production_cors` | Unit | CORS header allows diaryarchive.com only |
| `test_csp_headers_production` | Integration | All responses include CSP headers |
| `test_production_rate_limits` | Integration | Rate limits match final production values |
| `test_mongodb_authentication` | Integration | Connection with app user succeeds |
| `test_mongodb_backup_user` | Integration | Backup user can read any database |
| `test_smtp_connection` | Integration | SMTP server connection succeeds (if configured) |
| `test_backup_and_restore` | Integration | Backup creates valid file; restore succeeds |

### Load Tests

| Test | Target | Description |
|------|--------|-------------|
| `load_homepage` | 200 concurrent | Homepage serves in <2s P95 |
| `load_feed` | 200 concurrent | Public feed returns in <500ms P95 |
| `load_diary_reader` | 100 concurrent | Diary reader page serves in <1s P95 |
| `load_search` | 50 concurrent | Search returns in <500ms P95 |
| `load_auth_flow` | 20 req/s | Register + login under load |
| `stress_upload_media` | 10 concurrent uploads | 10MB uploads succeed under load |
| `ramp_test` | 0→200 users over 10min | No errors during ramp |

### Infrastructure Tests

| Test | Type | Description |
|------|------|-------------|
| Deploy from GitHub Actions | Integration | CI/CD pipeline completes successfully |
| Rollback from previous image | Manual | Can revert to previous Docker image |
| Backup execution | Integration | Backup script runs, uploads to R2 |
| Restore from backup | Integration | Can restore database from backup |
| Failover test | Manual | Stop mongodb-primary; verify secondary becomes primary |
| SSL certificate renewal | Manual | Auto-renewal via certbot or Cloudflare |
| Monitoring alerts | Integration | Trigger test alert; verify notification |

---

## Documentation

- `docs/deployment.md` — Comprehensive deployment guide including:
  - Server provisioning
  - Environment variable setup
  - Docker Compose production configuration
  - Nginx configuration
  - SSL certificate setup (Cloudflare)
  - Backup and restore procedures
  - Deployment rollback
  - Scaling guide

- `docs/monitoring.md` — Monitoring setup guide:
  - Health check configuration
  - Grafana dashboard setup
  - Alerting rules and thresholds
  - Log aggregation with Loki
  - Runbook for common alerts

- `docs/security.md` — Update with:
  - Production security configuration
  - SSH hardening
  - Cloudflare WAF rules
  - CSP headers
  - Rate limiting configuration
  - Incident response plan

- `README.md` — Update with:
  - Architecture overview (diagram)
  - Production domain URLs
  - Quick start for development
  - Deployment reference to docs/

- `docs/milestones/milestone-15.md` — This document

---

## Acceptance Criteria

1. `https://diaryarchive.com` loads correctly with valid SSL certificate (A+ rating).
2. `https://api.diaryarchive.com` responds with health check status.
3. GitHub Actions CI/CD deploys to production automatically on push to `main`.
4. Full user workflow works in production: register → login → create diary → upload image → comment → search → settings.
5. Cloudflare is proxying traffic with WAF active.
6. All production rate limits are enforced (429 returned on excess).
7. CSP headers are present and correct on all responses.
8. MongoDB replica set is healthy (1 primary, 1 secondary, 1 arbiter).
9. Redis is running with AOF persistence.
10. MinIO buckets (media-public, media-private) are created and accessible.
11. Daily encrypted backups are running and verified (backup file exists on R2).
12. Backups can be restored successfully (tested end-to-end once).
13. Monitoring health checks pass (UptimeRobot or similar).
14. Grafana dashboards show real-time metrics.
15. Log aggregation (Loki) is collecting logs from all services.
16. SMTP email sending works (password reset email received).
17. Load test passes (200 concurrent users, P95 <500ms API, <1% errors).
18. All critical security checks pass (SSL, headers, WAF, no open ports).
19. Soft launch completes with no blocking issues.
20. Rollback plan is documented and tested.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| DNS propagation delay | Medium | Set low TTL (300s) 48h before launch; pre-configure Cloudflare |
| SSL certificate expiry | Low | Auto-renewal via Cloudflare; monitor expiry with 14-day alert |
| MongoDB replica set election | Low | Arbiter ensures quorum; test failover before launch |
| Docker image build failure | Low | Pin base image versions; build and cache layers in CI |
| Secrets leaked in CI logs | Low | Mask all secrets in GitHub Actions; never echo environment |
| Backup restoration failure | Low | Automate backup verification; test restore before launch |
| Traffic spike on launch day | Medium | Load test to 5x expected traffic; auto-scaling ready |
| Cloudflare rate limiting too aggressive | Medium | Start with generous limits; tighten based on monitoring |
| Email deliverability issues | Medium | Configure SPF/DKIM/DMARC; use reputable provider (SendGrid) |
| Dependency vulnerability | Low | Automated vulnerability scanning in CI (npm audit, pip audit) |
| Disk space exhaustion from logs | Medium | Log rotation (10MB max, 3 files); monitor disk in Grafana |
| Database connection pool exhaustion | Low | Set `maxPoolSize=10` per container; monitor connections in MongoDB |

---

## Future Considerations

- Milestone 16 could focus on horizontal scaling: multiple backend instances, read replicas, CDN for media.
- Database sharding if user base grows beyond 100K active users.
- Multi-region deployment for global users (Cloudflare Workers for edge logic).
- Automated canary deployments and blue-green deployments.
- Self-healing infrastructure (auto-restart crashed containers, auto-rebuild after OOM).
- Cost optimization: reserved instances, spot instances for batch jobs, R2 vs MinIO cost analysis.
- User-facing status page (`status.diaryarchive.com`) with incident history.
- SOC2 compliance and formal security auditing for enterprise users.
- Rate limiting at Cloudflare level (already done) with per-user rate limits via API keys.
- Advanced monitoring: Real User Monitoring (RUM), Core Web Vitals tracking, error tracking (Sentry).
