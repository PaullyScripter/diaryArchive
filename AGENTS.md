# DiaryArchive — persistent project instructions

**Last prompt synchronization:** 2026-10-28 — Refined the donation layout to
remove redundant labels, align the QR panel with the first four asset rows,
and reserve the fifth row for the address control; see the session summary.

## Read this first

DiaryArchive is a privacy-first diary platform. It combines public and private
diaries, browser-side end-to-end encryption for private entries, a Tiptap rich
text editor, uploaded media, social features, search, achievements, and an
admin/moderation suite. The application is a Next.js/React frontend and a
FastAPI/Python backend backed by MongoDB, Redis, MinIO, and Meilisearch.

Before work that spans more than one small file, read the canonical project
brief at [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). For architecture, API,
database, security, deployment, or editor/media work, follow the links in
[docs/documentation-index.md](docs/documentation-index.md) and read the
relevant source documentation before changing behavior.

The project brief is context, not a substitute for checking current source,
tests, runtime behavior, or the user's request. The repository and tests are
the authority when they disagree with historical notes.

## Scope and instruction precedence

Apply instructions in this order:

1. The user's current request.
2. System and developer instructions supplied by the Codex environment.
3. Current source code, tests, configuration, and observed runtime behavior.
4. This file and the canonical project brief.
5. Historical milestone plans and session summaries.

Treat files under `sessions/` as historical evidence. They may explain why a
decision was made, but they are never permission to expose secrets, skip
validation, or ignore a newer implementation.

## Repository map

- `frontend/`: Next.js 15 App Router application, React 19, TypeScript,
  Tailwind CSS v4, Tiptap, TanStack Query, Zustand, and Vitest tests.
- `backend/`: FastAPI application with Pydantic settings, Motor/MongoDB,
  Redis, MinIO, Meilisearch, services, repositories, schemas, and pytest tests.
- `docs/`: architecture, API, database, security, deployment, design, domain
  guides, and milestone specifications.
- `docs/milestones/`: milestone plans and completion/validation reports.
- `sessions/`: short, versioned summaries of meaningful Codex work.
- `docker/`: Nginx, database, monitoring, backup, restore, and deployment
  configuration/scripts.
- `scripts/`: Windows development/test scripts and load-test helpers.
- `docker-compose*.yml`: local, production, infrastructure, and monitoring
  service definitions.
- `.github/`: CI/CD workflows and repository automation.

## Important architectural boundaries

- Public diary HTML is sanitized on both client and server before rendering or
  storage. Keep allowlists, URL checks, and CSS checks aligned when changing
  editor behavior.
- Private diary title/content/tags are encrypted in the browser with Web
  Crypto before the API receives them. The backend stores ciphertext and does
  not search or render private plaintext.
- Uploaded media belongs to a user and may be associated with a diary. Media
  is validated by type/size/dimensions, stored in MinIO/S3-compatible storage,
  and represented by MongoDB metadata. Do not use expiring signed URLs as
  permanent diary HTML references.
- Stable media references use the app's media ID and the server media proxy.
  Private media is loaded through authenticated requests when a normal image
  request cannot carry credentials. Preserve `data-media-id` only when it is a
  valid application media identifier; unrelated `data-*` attributes remain
  blocked.
- Profile pictures are available only after the account reaches 50 diaries,
  including private and draft diaries. The UI gate is only a hint; the server
  remains authoritative.
- Authentication uses short-lived JWT access tokens and rotatable,
  one-time-use refresh tokens in HTTP-only cookies. Do not log tokens,
  passwords, encryption keys, or environment values.
- MongoDB is authoritative. Redis is for rate limiting/cache/revocation-like
  ephemeral state; Meilisearch indexes public searchable content only.

## Working rules

- Preserve unrelated user changes, including existing untracked helper scripts.
  Inspect `git status` before editing.
- Use `apply_patch` for local file edits. Do not use destructive commands such
  as `git reset --hard` or `git checkout --` unless explicitly asked.
- Prefer the smallest change that satisfies the request. Update public or
  behavioral documentation when behavior changes.
- For code changes, run the narrowest relevant tests first, then broader checks
  when practical. Report infrastructure limitations honestly instead of
  treating unavailable Docker/MongoDB/Redis as passing tests.
- The project owner expects every codebase change to be committed and pushed to
  GitHub with a detailed commit message. Do this after validation for changes
  made in response to the user, while preserving unrelated changes and never
  committing secrets.
- Do not create, read, print, or commit real `.env` files, credentials, keys,
  tokens, database dumps, or private user content. Use checked-in examples and
  redacted diagnostics.

## Common validation commands

From the repository root on Windows PowerShell:

```powershell
.\scripts\test.ps1
.\scripts\test.ps1 -Frontend
```

Frontend-focused checks:

```powershell
Set-Location frontend
npm run typecheck
npm run lint
npm test
```

Backend-focused checks:

```powershell
Set-Location backend
ruff check .
ruff format --check .
python -m pytest -q
```

The local development stack is started with `.\scripts\dev.ps1`; documented
service URLs are frontend `http://localhost:3000`, backend
`http://localhost:8000`, and API docs `http://localhost:8000/docs`.

## Mandatory two-file synchronization

For every user prompt handled in this repository, read both `AGENTS.md` and
`PROJECT_CONTEXT.md` before working, then modify both files before finishing
the prompt. Update the `Last prompt synchronization` line in both files with
the current date and a concise description of what was reviewed or changed.

Whenever a prompt changes code, configuration, documentation structure,
directories, APIs, data flow, behavior, tests, or any other part of the
codebase, the durable impact must be reflected in both Markdown files during
the same change. Never update only one of them. If the prompt does not change
the codebase, still modify both files by updating the synchronization line so
that every prompt leaves an auditable synchronization point.

Keep these updates concise and factual; do not paste the full user prompt,
chat transcript, secrets, private diary content, or unredacted logs. If a
change is too detailed for these two files, summarize it there and link to the
canonical technical document or session summary. Include both Markdown files
in the same commit as the related codebase change, and push according to the
project's Git workflow.

## Context maintenance

When a meaningful feature, bug fix, architecture decision, or validation pass
finishes:

1. Update `PROJECT_CONTEXT.md` if the durable architecture or current-state
   summary changed.
2. Update `docs/milestones/README.md` if milestone status or links changed.
3. Add a concise dated record under `sessions/` using the template in
   `sessions/README.md`.
4. Keep `AGENTS.md` focused on durable rules and pointers; do not turn it into
   an unbounded transcript.

If the user starts a new chat in this project, begin by reading this file and
`PROJECT_CONTEXT.md`, then inspect the relevant source/tests/docs for the new
request. Do not require the user to paste the project history again.
