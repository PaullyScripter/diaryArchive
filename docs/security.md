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
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Content-Security-Policy (via application, not Nginx)

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
- [ ] MinIO bucket not publicly accessible
- [ ] MongoDB authentication enabled
- [ ] Redis password required
- [x] Private diary metadata is contained inside the client-encrypted payload
- [x] Mutable media is authorization-proxied with `private, no-store` caching

### Infrastructure
- [ ] UFW firewall enabled (only 22, 80, 443 open)
- [ ] fail2ban installed and configured
- [ ] SSH key-only authentication (no password login)
- [ ] Unattended security upgrades enabled
- [ ] Docker containers run as non-root
- [ ] Docker containers have `no-new-privileges`
- [ ] Docker containers have `read_only` filesystem
- [ ] Docker containers drop all capabilities
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
- [ ] Python dependencies audited (`pip-audit`)
- [ ] npm dependencies audited (`npm audit`)
- [ ] No known critical vulnerabilities
- [ ] Dependabot or Renovate configured

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
- All backups use an authenticated encrypt-then-MAC envelope (AES-256-CBC/PBKDF2 plus HMAC-SHA256); migrate to a managed AEAD/envelope-encryption service when available
- Encryption keys stored separately from backups
- Off-site backup storage (R2/S3)
- Daily automated backups with 30-day retention
