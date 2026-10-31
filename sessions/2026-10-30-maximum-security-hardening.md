# Maximum residual-risk hardening — 2026-10-30

## Request

Apply the maximum feasible protections for metrics exposure, CSP and external
image privacy, backup encryption, supply-chain risk, resource exhaustion,
browser-side encryption boundaries, and production operational controls; explain
why zero attacks cannot be guaranteed.

## Findings

- Public Nginx routes previously proxied `/api/v1/metrics`; the backend route
  had no production authentication.
- Public and editor diary flows still allowed arbitrary HTTPS images, creating
  reader-IP/referrer tracking exposure.
- Backups had a legacy authenticated CBC+HMAC format but no modern AEAD path.
- Python and npm root dependency specifications were ranges, and workflow
  actions used release tags.
- Upload byte/account/daily limits existed, but concurrent multipart buffering
  and processing were not bounded per backend process.
- Host firewall, SSH, secret permissions, WAF/bot protection, patching, and
  recovery drills cannot be proven from application source alone.

## Changes

- Added production metrics bearer-token validation from a mounted secret,
  fail-closed behavior, Nginx public 404 blocks, Prometheus secret scraping,
  and production compose service isolation.
- Made arbitrary diary image hosts a product-wide deny policy in frontend and
  backend sanitizers, CSP, editor UX warnings, and privacy documentation.
  Added COOP/agent-cluster/DNS-prefetch/permitted-domain headers.
- Added `backup-age.sh`, `restore-age.sh`, and `verify-restore-age.sh`; the
  existing scripts delegate to age when configured while preserving legacy
  archives only for migration.
- Exact-pinned Python application/dev dependencies and frontend root package
  specifications to the committed lock versions; added Dependabot, updated CI
  action majors to current Node-compatible releases, and pinned every workflow
  Action to a reviewed full commit SHA.
- Pinned all resolvable Docker base/service images to reviewed registry digests;
  MinIO remains a version tag because manifest lookup was denied by the
  available registries and is recorded as a pre-deploy gate.
- Added an upload processing semaphore, Nginx connection/status/body controls,
  production no-new-privileges boundaries, MinIO console disablement, and a
  fail-closed deployment preflight for metrics, age backups, TLS, and HTTPS.
- Added the production security checklist and synchronized `AGENTS.md` and
  `PROJECT_CONTEXT.md`.

## Verification

- Backend: `325 passed`; `ruff check app tests` passed.
- Frontend: `87 passed`; typecheck, lint, and production `next build` passed.
- Compose: production + monitoring config rendered successfully with
  non-secret placeholder variables.
- YAML workflow/compose parsing passed; `git diff --check` passed.
- Full repository `ruff format --check` still reports pre-existing formatting
  drift in unrelated legacy files; touched backend files were formatted.
- Shell scripts were reviewed but could not be run through Bash in this
  Windows environment because the WSL Bash shim is unavailable.

## Git

Committed locally as `security: close residual observability and supply-chain
risks`. The final commit ID is reported by the repository log after this
record is amended. No push is authorized by the user in this prompt.

## Follow-up

- Resolve and pin the MinIO production image to a reviewed immutable registry
  digest before granting production deploy credentials.
- Deploy the metrics token, age recipient, TLS files, firewall, SSH hardening,
  WAF/bot rules, host updates, and backup restore drill from the production
  checklist.
- Replace the remaining `style-src 'unsafe-inline'` dependency with a nonce or
  isolated renderer redesign if the advanced author-CSS feature is retained.
- Browser-side encryption cannot protect plaintext on a compromised client,
  malicious frontend bundle/dependency, browser extension, or stolen session.
