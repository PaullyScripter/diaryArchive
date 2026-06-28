import logging

from app.core.database import DatabaseManager
from app.search.config import PUBLIC_DIARIES_INDEX, get_client
from app.search.indexer import DiaryIndexer

logger = logging.getLogger(__name__)


async def full_reindex() -> int:
    logger.info("Starting full Meilisearch re-index...")
    indexer = DiaryIndexer()

    await indexer.clear_index()

    db = DatabaseManager.get_db()
    cursor = db.diaries.find(
        {"privacy": "public"},
        projection={
            "_id": 1, "title": 1, "content_text": 1, "content_html": 1,
            "tags": 1, "emotion": 1, "year": 1, "month": 1,
            "user_id": 1, "created_at": 1, "updated_at": 1,
            "stats": 1, "published_at": 1, "privacy": 1,
        },
    ).sort("created_at", -1)

    batch: list[dict] = []
    total = 0
    async for diary in cursor:
        batch.append(diary)
        if len(batch) >= 100:
            await indexer.bulk_index(batch)
            total += len(batch)
            batch = []
    if batch:
        await indexer.bulk_index(batch)
        total += len(batch)

    mongo_count = await db.diaries.count_documents({"privacy": "public"})
    index_stats = get_client().index(PUBLIC_DIARIES_INDEX).get_stats()
    index_count = index_stats.number_of_documents

    logger.info(
        "Full re-index complete. MongoDB public diaries: %d, Meilisearch documents: %d",
        mongo_count, index_count,
    )
    return total
