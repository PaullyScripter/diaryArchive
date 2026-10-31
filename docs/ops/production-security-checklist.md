# Production Security Checklist

Application code can enforce safe defaults, but several controls exist at the
host, edge, and account boundary. Complete this checklist before exposing a
production deployment.

## Edge and abuse resistance

- Put the host behind Cloudflare or an equivalent WAF/DDoS provider. Enable
  managed bot protection, request-body limits, upload-specific rules, and
  challenge/rate-limit rules for login, registration, password reset, media
  upload, and public diary reads.
- Allow inbound traffic only on TCP 22, 80, and 443. Keep MongoDB, Redis,
  MinIO, Meilisearch, Prometheus, Loki, and Grafana on the private Docker
  network; do not publish their ports.
- Confirm Nginx returns 404 for `/api/v1/metrics` on both `diaryarchive.com`
  and `api.diaryarchive.com`. Prometheus must use the private backend target
  and `/run/secrets/metrics_token`.
- Confirm TLS 1.2/1.3, certificate renewal, OCSP stapling, HSTS, and Cloudflare
  Full (Strict) mode. Test the final public headers after every proxy change.

## Secret and service isolation

- Keep `.env.production`, TLS private keys, Mongo keyfiles, and the age identity
  outside Git with mode `600` and an owner that cannot be read by unrelated
  users. Never put the age identity on the application host.
- Create a high-entropy metrics token file and set `METRICS_TOKEN_FILE` to it.
  The production compose overlay mounts it read-only into backend and
  Prometheus; rotate it by restarting both services.
- Keep the MinIO bucket private, disable the production MinIO browser console,
  and use the application media proxy. Keep Redis authentication enabled and
  verify that the app URI includes the password.
- Use the dedicated Mongo application user for the backend. Reserve the root
  user for provisioning, migrations, and recovery only.
- Run the production compose stack with the read-only/no-new-privileges/
  capability-drop settings intact. Do not add host bind mounts or debugging
  ports to the production override.

## Backups and recovery

- Prefer `BACKUP_AGE_RECIPIENT_FILE` and the `.age` artifact path. Store the
  identity offline or behind a KMS/HSM workflow; never place it in `.env` on the
  app host.
- Upload encrypted backups to a separate account/bucket with object lock or
  immutable retention. The backup account must not be able to delete the live
  data bucket.
- Run `verify-restore.sh` and a full restore drill on a schedule. Record the
  recovery time, recovered record counts, media checks, and the person who
  approved the drill. A backup that has never been restored is not a recovery
  plan.

## Host and account controls

- Disable SSH password login and root login; require keys, MFA/bastion access,
  and fail2ban or an equivalent SSH abuse control.
- Apply unattended security updates, reboot after kernel/runtime security
  updates, and monitor Docker/Mongo/Redis/MinIO/Meilisearch advisories.
- Protect the GitHub organization/repository with branch protection, required
  reviews, secret scanning, Dependabot, least-privilege environments, and
  approval gates for production deploys. Workflow actions and resolvable
  production Docker images are reviewed and pinned; resolve the remaining
  MinIO manifest digest before granting deploy credentials.
- Use separate staging and production credentials. Rotate deploy keys,
  database credentials, SMTP credentials, metrics tokens, and backup recovery
  material after any suspected exposure.

## Browser-side encryption boundary

Private diary encryption protects plaintext from the backend and database, but
not a compromised browser extension, user device, malicious frontend build,
malicious dependency, or an attacker controlling the account session. Keep
third-party scripts out of the frontend, review dependency and CI changes,
serve only over TLS, enable MFA/WebAuthn when available, and encourage users
to keep browsers and devices patched.
