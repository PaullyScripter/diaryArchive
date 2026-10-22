# DiaryArchive documentation index

This index helps a new contributor or Codex session choose the smallest set of
documents needed for a task. The repository root `AGENTS.md` and
`PROJECT_CONTEXT.md` are the durable entry points; this file maps into `docs/`.

## Read by task

| Task area | Read first | Then inspect |
| --- | --- | --- |
| Product overview/startup | `README.md`, `PROJECT_CONTEXT.md` | `scripts/`, compose files |
| Overall architecture | `docs/architecture.md` | backend/frontend source, `docs/database.md` |
| REST/API behavior | `docs/api.md` | routers, schemas, services, frontend hooks |
| MongoDB/data changes | `docs/database.md` | models, schemas, repositories, migrations, indexes |
| Diary/editor work | architecture sections 11–14 | editor components/lib, diary service/routes |
| Images/media | project brief media section, API section 12 | media service/route, media-url utilities, media components |
| Private diaries/encryption | architecture sections 10 and 12 | crypto hooks, diary service, private-media path, tests |
| Sanitization/XSS | `docs/security.md`, `docs/security-audit-2026.md` | backend sanitizer, frontend sanitizer, warning tests |
| Profiles/avatars | API user/profile sections | user routes/services, settings/profile/avatar/media code |
| Social/notifications | API sections 6–10 | routers, services, hooks, components |
| Admin/moderation | API section 15 | admin/report/ticket/warning/appeal routes and pages |
| Deployment/release | `docs/deployment.md`, `docs/monitoring.md` | compose overlays, `docker/`, GitHub workflows |
| Security review | security docs | auth, middleware, config, upload validation, rate limiting |
| UI/layout/accessibility | `docs/frontend-design.md` | components, route layouts, tests |
| Project history | milestones README, sessions README | relevant milestone and dated summary |

## Top-level references

- [`architecture.md`](architecture.md) — system design, boundaries,
  persistence, encryption, media, search, security, privacy, deployment, and
  scaling.
- [`api.md`](api.md) — REST v1 endpoint contracts and response/error examples.
- [`database.md`](database.md) — MongoDB document shapes, indexes, and lifecycle.
- [`deployment.md`](deployment.md) — deployment and rollback instructions.
- [`monitoring.md`](monitoring.md) — health, metrics, logs, dashboards, alerts.
- [`security.md`](security.md) — security configuration and incident response.
- [`security-audit-2026.md`](security-audit-2026.md) — dated security review.
- [`frontend-design.md`](frontend-design.md) — UI/UX and responsive layout.
- [`roadmap.md`](roadmap.md) — original phased roadmap.

## Domain guides

The `docs/diary-*` directories contain focused guides for architecture,
backend, database, deployment, documentation, encryption, frontend, mobile,
performance, search, security, testing, and UI systems. `docs/ops` contains
operational runbooks and checklists. Use these for specialized tasks; do not
load every guide for a small isolated change.

## Maintenance rules

- Update the relevant contract when public behavior, API, security, or
  operations change.
- Keep the project brief high-signal; put detailed endpoint/schema material in
  the canonical technical docs instead of duplicating it.
- Mark historical reports with their date and environment limitations.
- Never include secrets, real tokens, private diary text, database dumps, or
  production credentials in documentation or session summaries.
