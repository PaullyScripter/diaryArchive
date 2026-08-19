"""Regression tests for the migration runner and DB-level data-integrity
enforcement (LOW-2, LOW-7, LOW-8, MED-3)."""
import pytest

from app.core.database import DatabaseManager
from app.migrations.run_migrations import MIGRATIONS, run_migrations


@pytest.mark.asyncio
async def test_run_migrations_is_idempotent_and_tracked():
    """Migrations apply once, are recorded, and re-running applies nothing."""
    first = await run_migrations()
    assert first["applied"] >= 2
    assert first["failed"] == []

    # Second run applies nothing new.
    second = await run_migrations()
    assert second["applied"] == 0
    assert second["skipped"] >= 2

    db = DatabaseManager.get_db()
    versions = await db.schema_migrations.distinct("version")
    assert len(versions) == len(MIGRATIONS)


@pytest.mark.asyncio
async def test_unique_pending_report_index_enforced():
    """LOW-7: the unique pending-report index blocks a second pending report
    from the same reporter on the same target at the DB level."""
    await run_migrations()
    db = DatabaseManager.get_db()
    from bson import ObjectId

    reporter = ObjectId()
    target = ObjectId()

    await db.reports.insert_one({
        "reporter_id": reporter,
        "target_type": "user",
        "target_id": target,
        "reason": "spam",
        "status": "pending",
        "created_at": None,
    })

    from pymongo.errors import DuplicateKeyError

    with pytest.raises(DuplicateKeyError):
        await db.reports.insert_one({
            "reporter_id": reporter,
            "target_type": "user",
            "target_id": target,
            "reason": "harassment",
            "status": "pending",
            "created_at": None,
        })

    # A resolved report does not collide with a pending one.
    await db.reports.insert_one({
        "reporter_id": reporter,
        "target_type": "user",
        "target_id": target,
        "reason": "other",
        "status": "resolved",
        "created_at": None,
    })


@pytest.mark.asyncio
async def test_bug_reports_not_covered_by_unique_index():
    """Bug reports skip duplicate checks and must not trip the unique index."""
    db = DatabaseManager.get_db()
    from bson import ObjectId

    reporter = ObjectId()
    for _ in range(2):
        await db.reports.insert_one({
            "reporter_id": reporter,
            "target_type": "bug",
            "target_id": None,
            "reason": "bug",
            "status": "pending",
            "created_at": None,
        })
