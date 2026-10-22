# DiaryArchive session summaries

This folder stores short, versioned summaries of meaningful work so a future
Codex chat can recover recent decisions without importing an entire transcript.
It is not a dump of chat logs. Raw/local session exports remain ignored by
`.gitignore`; durable Markdown summaries are tracked.

## Naming

Use `YYYY-MM-DD-short-topic.md`, with lowercase hyphen-separated words. If
several summaries are created on one day, add a clarifying suffix rather than
overwriting an existing record.

## Required template

Use these sections:

- `Request`: what the user asked for.
- `Findings`: evidence, affected flows, and decisions.
- `Changes`: files and behavior changed.
- `Verification`: commands, results, and limitations.
- `Git`: commit hash/message and push status when authorized.
- `Follow-up`: remaining risks or next files to inspect.

## Rules

- Summaries must be factual and dated.
- Link to repository files with relative Markdown links where useful.
- Record failures and environment limitations, not only successes.
- Do not include secrets, tokens, passwords, real email addresses, private
  diary text, database dumps, or unredacted logs.
- Historical summaries never override current source, tests, or the user's
  current request.
- Update `PROJECT_CONTEXT.md` separately when a fact should be loaded for every
  future project chat.
