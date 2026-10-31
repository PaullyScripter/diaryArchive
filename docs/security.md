# Security Configuration

This document covers production security configuration for DiaryArchive.

## Pre-Launch Security Checklist

### SSL/TLS
- [ ] SSL certificate valid (A+ rating on SSL Labs)
- [ ] TLS 1.2+ only (no TLS 1.0/1.1)
- [ ] HSTS header enabled (`max-age=63072000; includeSubDomains; preload`)
- [ ] OCSP stapling enabled
- [ ] Cloudflare SSL mode: Full (Strict)

### Security Headers
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] Content-Security-Policy (via application, not Nginx); arbitrary remote
  images are excluded from both CSP and the client/server HTML sanitizers
- [x] Cross-origin opener, agent-cluster, DNS-prefetch, and permitted-domain
  headers are set by the frontend/backend and Nginx

### Authentication & Authorization
- [ ] JWT tokens expire in 15 minutes
- [ ] Refresh tokens expire in 7 days
- [ ] Rate limiting on login (10 req/min)
- [ ] Rate limiting on register (5 req/min)
- [ ] Account lockout after 5 failed attempts (15 min cooldown)
- [ ] Password requirements enforced (8+ chars, complexity)
- [ ] CSRF posture reviewed: refresh cookie is `SameSite=Strict`, path-scoped,
  and never used as an API authorization bearer token

### Data Protection
- [ ] End-to-end encryption for private diaries
- [ ] AES-256-GCM for email encryption
- [x] MinIO bucket not publicly accessible in the production compose overlay;
  the MinIO browser console is disabled there
- [x] MongoDB authentication enabled in the production compose overlay
- [x] Redis password required in the production compose overlay
- [x] Private diary metadata is contained inside the client-encrypted payload
- [x] Mutable media is authorization-proxied with `private, no-store` caching

### Infrastructure
- [ ] UFW firewall enabled (only 22, 80, 443 open)
- [ ] fail2ban installed and configured
- [ ] SSH key-only authentication (no password login)
- [ ] Unattended security upgrades enabled
- [x] Application containers run as non-root
- [x] Production services use `no-new-privileges` where supported
- [x] Application containers have `read_only` filesystems
- [x] Frontend/backend containers drop all capabilities
- [x] Backend uses a dedicated MongoDB application user with only `readWrite`;
  root credentials are
  reserved for database administration

### Secrets Management
- [ ] No secrets in version control
- [ ] `.env.production` has 600 permissions
- [ ] No `NEXT_PUBLIC_*` variables expose secrets
- [ ] No hardcoded tokens in source code
- [ ] Secret scanning enabled (Gitleaks in CI)

### Dependencies
- [x] Python dependencies are version-pinned and audited (`pip-audit`)
- [x] npm dependencies use the committed lockfile and are audited (`npm audit`)
- [ ] No known critical vulnerabilities
- [x] Dependabot configured for Actions, npm, pip, and Docker manifests
- [x] Every third-party GitHub Action pinned to a reviewed full commit SHA;
  Dependabot should propose reviewed updates rather than floating tags
- [x] Production Docker base/service images are pinned to reviewed registry
  digests where the registry exposes a resolvable manifest
- [ ] MinIO production image still needs an immutable registry digest; its
  version tag is an explicit pre-deploy gate because manifest lookup was denied
  by the available registries

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 10 req | 60s |
| Register | 5 req | 60s |
| Password reset | 3 req | 3600s |
| API (general) | 30 req/s | sliding |
| Upload | 5 req/s | sliding |
| Health check | 1 req/s | sliding |

## CSP Policy

The Content-Security-Policy is managed by the application layers:
- **Frontend:** `next.config.ts` headers
- **Backend:** `CSPSecurityMiddleware`

Nginx does NOT set CSP headers to avoid conflicts with application-configured CSP.
The frontend still permits `style-src 'unsafe-inline'` because the product
supports sanitized author CSS and React runtime style attributes. The residual
risk is bounded by CSS parsing/blocklists, URL removal, selector scoping, and
Shadow DOM isolation; replacing it with per-response nonces requires a larger
editor/rendering redesign. Treat this as an explicit accepted residual, not as
proof that CSP alone protects a compromised browser or frontend bundle.

Metrics are not a public observability API: Nginx returns 404 for the metrics
path on both public hosts, and the backend requires a bearer token from the
mounted `METRICS_TOKEN_FILE` secret when `DEBUG=false`.

## Incident Response

### Security Incident Checklist
1. **Contain:** Revoke compromised credentials immediately
2. **Assess:** Determine scope of data exposure
3. **Notify:** Inform affected users within 72 hours (GDPR)
4. **Remediate:** Fix vulnerability, deploy patch
5. **Review:** Post-incident analysis, update security measures

### Emergency Contacts
- **Security team:** security@diaryarchive.com
- **Infrastructure:** ops@diaryarchive.com

### Rollback Procedure
```bash
# Quick rollback to previous version
cd /opt/diaryarchive
./docker/scripts/deploy.sh <previous-commit-sha>
```

## Security Monitoring

### Logs to Monitor
- Failed login attempts
- Rate limit violations
- 4xx/5xx error spikes
- Unusual access patterns
- Admin action audit logs

### Grafana Alerts
- High error rate (> 5% for 5 min)
- Unusual traffic spikes
- Service downtime

## Compliance

### GDPR Considerations
- User data export available
- User account deletion available
- Privacy policy published
- Terms of service published
- Data retention policies configured

### Data Storage
- **MongoDB:** User data, diaries, comments
- **Redis:** Sessions, rate limits, cache
- **MinIO:** Media files (images, attachments)
- **Meilisearch:** Search indices

### Backup Encryption
- New production backups should use `BACKUP_AGE_RECIPIENT_FILE`, which routes
  through age's authenticated encryption; `backup.sh`/`restore.sh` retain the
  old CBC+HMAC path only to migrate existing archives
- Encryption keys stored separately from backups
- Off-site backup storage (R2/S3)
- Daily automated backups with 30-day retention
