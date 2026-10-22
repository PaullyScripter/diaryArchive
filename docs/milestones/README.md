# DiaryArchive milestone index

This directory contains phased implementation plans and later
completion/validation reports. The roadmap is historical planning context; the
current source tree, tests, deployment evidence, and user's request decide
what is actually complete.

## Phase map

| Phase | Milestones | Theme |
| --- | --- | --- |
| 1 | M1–M4 | foundation, backend/frontend skeleton, authentication |
| 2 | M5–M8 | profiles, public diaries, rich editor, private encryption |
| 3 | M9–M11 | social features, explore/search, notifications |
| 4 | M12–M14 | admin, media, polish/performance |
| 5 | M15 | production deployment and launch operations |

## Files

- [M03](milestone-03.md) — frontend foundation/design slice.
- [M04](milestone-04.md) — authentication.
- [M05](milestone-05.md) — user profiles and profile UI.
- [M06](milestone-06.md) — public diaries and baseline sanitization.
- [M07](milestone-07.md) — Tiptap rich-text editor, drafts, editor flow.
- [M08](milestone-08.md) — private diaries and client-side encryption.
- [M09](milestone-09.md) — social interactions and comments.
- [M10](milestone-10.md) — explore/search.
- [M11](milestone-11.md) — notifications.
- [M12](milestone-12.md) — admin/moderation dashboard.
- [M13](milestone-13.md) — media system and object storage.
- [M14](milestone-14.md) — polish, accessibility, caching, performance,
  and operational hardening.
- [M14 completion](milestone-14-completion.md) — engineering completion report.
- [M14 validation](milestone-14-validation.md) — dated release-candidate
  validation report and environment caveats.
- [M15](milestone-15.md) — production deployment, monitoring, backup, CI/CD,
  load testing, and launch acceptance criteria.

## Current interpretation

M14 is documented as engineering-complete, with manual device/screen-reader
validation and infrastructure-dependent checks called out as remaining or
environment-limited. M15 is the latest documented phase and is primarily a
production deployment plan/checklist. Do not report M15 acceptance criteria as
verified without current evidence from the target environment.

The current branch also contains post-plan fixes for profile picture
gating/cropping, media persistence/sanitization, private media loading, and
preview image hydration. Those are current product behavior even where older
milestone plans describe an earlier implementation.

## Updating the index

When a milestone meaningfully changes: update the milestone document or add a
dated completion/validation report; update the interpretation above; update
`PROJECT_CONTEXT.md` only for durable architecture/current-state changes; and
add a session summary under `sessions/`. Keep plans, results, and unresolved
validation gaps separate. A plan is not a test result.
