---
name: diary-database
description: MongoDB data modeling, indexes, aggregation pipelines, schema evolution, and performance for DiaryArchive.
---

# DiaryArchive Database Skill

Design schemas for long-term maintainability.

## Principles
- Embed only when document growth is bounded.
- Reference large or high-cardinality relationships.
- Add indexes before features are considered complete.
- Prefer explicit schema versioning.

## Collections
- users
- diaries
- comments
- likes
- bookmarks
- follows
- notifications
- reports
- audit_logs
- media

## Always
- Explain index choices.
- Consider query performance.
- Avoid N+1 patterns.
- Design for 10k users with room to grow.
