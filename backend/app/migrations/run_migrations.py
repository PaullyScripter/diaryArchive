"""Idempotent, versioned, observable MongoDB migrations for DiaryArchive.

A single, simple migration runner that:
  - Tracks applied migrations in a `schema_migrations` collection.
  - Runs each registered migration at most once (by name/version).
  - Is repeatable/idempotent and failure-aware (an exception stops the run and
    is reported; a partially applied migration must be safe to re-run).
  - Is invoked explicitly (deploy.sh) and never blocks normal startup.

New migrations are appended to MIGRATIONS as Migration objects. Each migration
must be idempotent with respect to its own partial application.

Usage (inside the backend container):
  python -m app.migrations.run_migrations
"""
import asyncio
import logging

from app.core.database import DatabaseManager
from app.core.indexes import create_indexes

logger = logging.getLogger(__name__)


class Migration:
    """A single versioned migration with an idempotent apply() body."""

    def __init__(self, version: int, name: str, apply):
        self.version = version
        self.name = name
        self.apply = apply  # async callable accepting the db handle


async def _ensure_schema_migration_collection(db) -> None:
    await db.schema_migrations.create_index("version", unique=True)


async def _applied_versions(db) -> set[int]:
    docs = await db.schema_migrations.find({}, {"version": 1, "_id": 0}).to_list(
        length=10000
    )
    return {d["version"] for d in docs}


async def run_migrations(collection_name: str | None = None) -> dict:
    """Run all pending migrations. Returns a summary dict.

    Failures are NOT swallowed: the caller (deploy.sh) treats a non-zero exit as
    a failed rollout and aborts.
    """
    await DatabaseManager.connect_mongo()
    db = DatabaseManager.get_db()

    await _ensure_schema_migration_collection(db)
    applied = await _applied_versions(db)

    pending = [m for m in MIGRATIONS if m.version not in applied]
    summary = {"applied": 0, "skipped": len(MIGRATIONS) - len(pending), "failed": []}

    for migration in sorted(pending, key=lambda m: m.version):
        try:
            await migration.apply(db)
            await db.schema_migrations.insert_one(
                {"version": migration.version, "name": migration.name}
            )
            summary["applied"] += 1
            logger.info("Migration applied: %s (v%s)", migration.name, migration.version)
        except Exception as exc:  # noqa: BLE001 - must be observable, not silent
            logger.exception(
                "Migration FAILED: %s (v%s): %s", migration.name, migration.version, exc
            )
            summary["failed"].append({"version": migration.version, "name": migration.name})

    # Indexes are data-integrity infrastructure: create them as part of the
    # migration stage too (idempotent; create_indexes skips existing ones).
    if summary["failed"]:
        logger.error("One or more migrations failed: %s", summary["failed"])
        raise RuntimeError(f"Migrations failed: {summary['failed']}")

    # Reconcile required indexes (LOW-8 hardening: fail-closed if required
    # indexes cannot be created).
    await create_indexes()

    logger.info(
        "Migration run complete: applied=%d skipped=%d failed=%d",
        summary["applied"],
        summary["skipped"],
        len(summary["failed"]),
    )
    return summary


# ─────────────────────────────────────────────────────────────────────────────
# Registered migrations. Append new ones here with the NEXT version number.
# Every apply() MUST be idempotent.
# ─────────────────────────────────────────────────────────────────────────────

async def create_search_sync_outbox(db) -> None:
    """Search synchronization outbox: primary DB changes are durably recorded
    here before being pushed to Meilisearch (MED-3)."""
    await db.search_sync_outbox.create_index([("status", 1), ("created_at", 1)])
    await db.search_sync_outbox.create_index([("status", 1), ("attempt_count", 1)])


async def unique_report_index(db) -> None:
    """One pending report per (reporter, target_type, target_id).

Uses a partial index so only 'pending' reports are constrained, allowing a
    reporter to re-report a resolved resource. Bug reports have a null
    target_id and are excluded from the index (they skip duplicate checks and
    are not subject to the reporter/target invariant). This makes the
    previously application-level, raceable duplicate check an enforced DB
    invariant.
    """
    await db.reports.create_index(
        [
            ("reporter_id", 1),
            ("target_type", 1),
            ("target_id", 1),
        ],
        unique=True,
        partialFilterExpression={
            "status": {"$in": ["pending"]},
            "target_id": {"$type": "objectId"},
        },
        name="uq_reports_pending_reporter_target",
    )


MIGRATIONS: list[Migration] = [
    # v1: create the durable search-sync outbox collection and its indexes.
    Migration(
        version=1,
        name="create_search_sync_outbox",
        apply=create_search_sync_outbox,
    ),
    # v2: unique index preventing duplicate equivalent reports (LOW-7).
    Migration(
        version=2,
        name="unique_report_index",
        apply=unique_report_index,
    ),
]


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    summary = await run_migrations()
    logger.info("Migrations summary: %s", summary)


if __name__ == "__main__":
    asyncio.run(main())
