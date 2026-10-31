import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.database import DatabaseManager
from app.search.config import INDEX_SETTINGS, PUBLIC_DIARIES_INDEX, get_client
from app.search.indexer import DiaryIndexer

logger = logging.getLogger(__name__)

_reindex_lock = asyncio.Lock()

# Durable search-sync outbox (MED-3).
OUTBOX_MAX_ATTEMPTS = 6
OUTBOX_BACKOFF_SECONDS = 30
OUTBOX_BATCH_SIZE = 200
OUTBOX_LEASE_SECONDS = 120


async def enqueue_sync(diary_id: str, action: str = "index") -> None:
    """Durably record a pending index/remove operation in MongoDB before it is
    pushed to Meilisearch. Idempotent: re-enqueueing an already-pending diary
    updates the intent rather than creating duplicates."""
    try:
        db = DatabaseManager.get_db()
        oid = ObjectId(diary_id)
        now = datetime.now(UTC)
        await db.search_sync_outbox.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "pending",
                    "action": action,
                    "updated_at": now,
                    "next_attempt_at": now,
                },
                "$setOnInsert": {"created_at": now, "attempt_count": 0},
            },
            upsert=True,
        )
    except Exception:
        logger.warning("Failed to enqueue search sync for diary %s", diary_id, exc_info=True)


async def _run_index_op(action: str, diary_id: str) -> bool:
    """Perform the actual Meilisearch op for a diary. Returns True on success.

    The diary's CURRENT persisted state decides the operation: if it is public
    and its author is not banned we (re)index, otherwise we remove it from the
    index. This makes the outbox self-healing regardless of the stored hint.
    """
    db = DatabaseManager.get_db()
    try:
        oid = ObjectId(diary_id)
    except Exception:
        return False

    diary = await db.diaries.find_one({"_id": oid})
    indexer = DiaryIndexer()

    if diary and diary.get("privacy") == "public":
        from app.repositories.user_repo import UserRepository

        author = await UserRepository().get_by_id(str(diary["user_id"]))
        if author and author.get("is_banned"):
            await indexer.remove_diary(diary_id)
            return True
        await indexer.index_diary(diary)
        return True

    await indexer.remove_diary(diary_id)
    return True


async def process_outbox(max_entries: int | None = None) -> dict:
    """Consume pending outbox entries and push changes to Meilisearch.

    Returns a summary (for logs/metrics). Failed entries are retried with
    exponential backoff and marked failed after OUTBOX_MAX_ATTEMPTS, so a
    transient search outage never loses an intended index change.
    """
    db = DatabaseManager.get_db()
    now = datetime.now(UTC)
    limit = max_entries or OUTBOX_BATCH_SIZE

    # Claim work atomically so multiple backend replicas cannot process the
    # same entry concurrently. Expired claims are recoverable after a worker
    # crash.
    pending = []
    for _ in range(limit):
        entry = await db.search_sync_outbox.find_one_and_update(
            {
                "$or": [
                    {"status": "pending", "next_attempt_at": {"$lte": now}},
                    {
                        "status": "processing",
                        "lease_until": {"$lte": now},
                    },
                ]
            },
            {
                "$set": {
                    "status": "processing",
                    "lease_until": now + timedelta(seconds=OUTBOX_LEASE_SECONDS),
                    "updated_at": now,
                }
            },
            sort=[("created_at", 1)],
            return_document=ReturnDocument.AFTER,
        )
        if entry is None:
            break
        pending.append(entry)

    summary = {"processed": 0, "succeeded": 0, "failed": 0, "left_pending": len(pending)}

    for entry in pending:
        diary_id = str(entry["_id"])
        try:
            ok = await _run_index_op(entry.get("action", "index"), diary_id)
        except Exception:
            logger.warning("Search sync op raised for %s", diary_id, exc_info=True)
            ok = False

        if ok:
            await db.search_sync_outbox.update_one(
                {"_id": entry["_id"], "status": "processing"},
                {"$set": {"status": "done", "updated_at": now}, "$unset": {"lease_until": ""}},
            )
            summary["succeeded"] += 1
        else:
            attempts = entry.get("attempt_count", 0) + 1
            if attempts >= OUTBOX_MAX_ATTEMPTS:
                await db.search_sync_outbox.update_one(
                    {"_id": entry["_id"], "status": "processing"},
                    {
                        "$set": {
                            "status": "failed",
                            "attempt_count": attempts,
                            "updated_at": now,
                        }
                        , "$unset": {"lease_until": ""}
                    },
                )
                summary["failed"] += 1
            else:
                backoff = OUTBOX_BACKOFF_SECONDS * (2 ** (attempts - 1))
                await db.search_sync_outbox.update_one(
                    {"_id": entry["_id"], "status": "processing"},
                    {
                        "$set": {
                            "status": "pending",
                            "attempt_count": attempts,
                            "next_attempt_at": now + timedelta(seconds=backoff),
                            "updated_at": now,
                        }
                        , "$unset": {"lease_until": ""}
                    },
                )
            summary["failed"] += 1
        summary["processed"] += 1

    return summary


async def reconcile_outbox() -> dict:
    """Push any DB documents still pending in the outbox (a safety net that runs
    alongside the periodic worker and after a full reindex)."""
    return await process_outbox()


async def full_reindex(max_retries: int = 5) -> int:
    if _reindex_lock.locked():
        logger.warning("Reindex already in progress, skipping")
        return 0
    async with _reindex_lock:
        return await _do_reindex(max_retries)


async def _do_reindex(max_retries: int) -> int:
    logger.info("Starting full Meilisearch re-index...")

    idx = None
    for attempt in range(max_retries):
        try:
            client = get_client()
            try:
                idx = client.get_index(PUBLIC_DIARIES_INDEX)
            except Exception:
                idx = client.create_index(PUBLIC_DIARIES_INDEX, {"primaryKey": "id"})
            await asyncio.to_thread(lambda: idx.update_settings(INDEX_SETTINGS))
            logger.info("Index settings applied")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(
                    "Meilisearch not ready, retrying in 2s (%d/%d): %s", attempt + 1, max_retries, e
                )
                await asyncio.sleep(2)
            else:
                logger.warning(
                    "Meilisearch not available after %d attempts - reindex skipped: %s",
                    max_retries,
                    e,
                )
                return 0

    client = get_client()
    rebuild_index = f"{PUBLIC_DIARIES_INDEX}_rebuild_{uuid.uuid4().hex[:12]}"
    try:
        await asyncio.to_thread(
            lambda: client.create_index(rebuild_index, {"primaryKey": "id"})
        )
        rebuild = client.index(rebuild_index)
        await asyncio.to_thread(lambda: rebuild.update_settings(INDEX_SETTINGS))
    except Exception:
        logger.warning("Could not create temporary Meilisearch rebuild index", exc_info=True)
        return 0

    # Build in isolation. The live index remains available and consistent if
    # MongoDB or Meilisearch fails partway through the rebuild.
    indexer = DiaryIndexer(index_name=rebuild_index)

    db = DatabaseManager.get_db()

    from app.repositories.user_repo import UserRepository

    user_repo = UserRepository()
    banned_ids = await user_repo.get_banned_user_ids()

    cursor = db.diaries.find(
        {"privacy": "public", "user_id": {"$nin": banned_ids}}
        if banned_ids
        else {"privacy": "public"},
        projection={
            "_id": 1,
            "title": 1,
            "content_text": 1,
            "tags": 1,
            "emotion": 1,
            "year": 1,
            "month": 1,
            "user_id": 1,
            "created_at": 1,
            "updated_at": 1,
            "stats": 1,
            "published_at": 1,
            "privacy": 1,
        },
    ).sort("created_at", -1)

    batch: list[dict] = []
    total = 0
    skipped = 0
    async for diary in cursor:
        batch.append(diary)
        if len(batch) >= 100:
            try:
                await indexer.bulk_index(batch)
            except Exception:
                logger.warning(
                    "Batch indexing failed for %d documents, retrying individually", len(batch)
                )
                for d in batch:
                    try:
                        await indexer.index_diary(d)
                        total += 1
                    except Exception:
                        logger.warning("Failed to index diary %s", d.get("_id"))
                        skipped += 1
                batch = []
                continue
            total += len(batch)
            logger.info("Indexed batch of %d, running total: %d", len(batch), total)
            batch = []
    if batch:
        try:
            await indexer.bulk_index(batch)
        except Exception:
            logger.warning(
                "Final batch indexing failed for %d documents, retrying individually", len(batch)
            )
            for d in batch:
                try:
                    await indexer.index_diary(d)
                    total += 1
                except Exception:
                    logger.warning("Failed to index diary %s", d.get("_id"))
                    skipped += 1
            batch = []
            logger.info("Indexed final batch individually, total: %d, skipped: %d", total, skipped)
            if skipped:
                await asyncio.to_thread(lambda: client.delete_index(rebuild_index))
                return 0
        total += len(batch)
        logger.info("Indexed final batch of %d, total: %d", len(batch), total)

    if skipped:
        await asyncio.to_thread(lambda: client.delete_index(rebuild_index))
        logger.warning("Full re-index left live index unchanged; %d documents failed", skipped)
        return 0

    try:
        task = await asyncio.to_thread(
            lambda: client.swap_indexes(
                [{"indexes": [PUBLIC_DIARIES_INDEX, rebuild_index]}]
            )
        )
        task_uid = getattr(task, "task_uid", getattr(task, "uid", None))
        if task_uid is not None:
            await asyncio.to_thread(client.wait_for_task, task_uid, 30000, 100)
        await asyncio.to_thread(lambda: client.delete_index(rebuild_index))
    except Exception:
        logger.warning("Could not atomically publish rebuilt search index", exc_info=True)
        try:
            await asyncio.to_thread(lambda: client.delete_index(rebuild_index))
        except Exception:
            pass
        return 0

    mongo_count = await db.diaries.count_documents({"privacy": "public"})
    index_stats = await asyncio.to_thread(lambda: client.index(PUBLIC_DIARIES_INDEX).get_stats())
    index_count = index_stats.number_of_documents

    logger.info(
        "Full re-index complete. MongoDB public diaries: %d, Meilisearch documents: %d",
        mongo_count,
        index_count,
    )
    return total
