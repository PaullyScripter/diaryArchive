import logging

from pymongo import IndexModel

from app.core.database import DatabaseManager
from app.schemas import ALL_INDEXES

logger = logging.getLogger(__name__)

# These indexes existed in earlier releases. The first two were TTL indexes
# on media.created_at and silently deleted uploaded images after seven days.
# The last one attempted to use media.diary_id as a TTL field, which is not a
# date and therefore could not implement the intended orphan cleanup. Index
# creation is intentionally additive, so existing installations need an
# explicit cleanup step when they upgrade.
_OBSOLETE_MEDIA_INDEXES = frozenset({"idx_created_at_ttl", "created_at_1", "idx_orphan_ttl"})
_OBSOLETE_RETENTION_INDEXES = {
    "audit_logs": frozenset({"idx_created_at_ttl"}),
    "reports": frozenset({"idx_created_at_ttl"}),
    "notifications": frozenset({"idx_created_at_ttl"}),
}


async def remove_obsolete_media_indexes() -> list[str]:
    """Drop historical media TTL indexes that can delete user uploads."""
    db = DatabaseManager.get_db()
    existing = await db.media.index_information()
    removed: list[str] = []
    for name in _OBSOLETE_MEDIA_INDEXES:
        info = existing.get(name)
        if not info:
            continue
        if name in {"idx_created_at_ttl", "created_at_1"} and "expireAfterSeconds" not in info:
            continue
        await db.media.drop_index(name)
        removed.append(name)
        logger.warning("Removed obsolete media index %s", name)
    return removed


async def remove_obsolete_retention_indexes() -> list[str]:
    """Remove TTL indexes that contradict permanent user-visible history."""
    db = DatabaseManager.get_db()
    removed: list[str] = []
    for collection_name, names in _OBSOLETE_RETENTION_INDEXES.items():
        existing = await db[collection_name].index_information()
        for name in names:
            if name in existing:
                await db[collection_name].drop_index(name)
                removed.append(f"{collection_name}.{name}")
                logger.warning("Removed obsolete retention index %s.%s", collection_name, name)
    return removed


async def create_indexes() -> None:
    db = DatabaseManager.get_db()
    try:
        await remove_obsolete_media_indexes()
    except Exception as e:
        logger.error("Failed to remove obsolete media indexes: %s", e)
    try:
        await remove_obsolete_retention_indexes()
    except Exception as e:
        logger.error("Failed to remove obsolete retention indexes: %s", e)

    for collection_name, indexes in ALL_INDEXES.items():
        try:
            existing = await db[collection_name].index_information()
            models: list[IndexModel] = []
            for keys, kwargs in indexes:
                index_name = kwargs.get("name", "")
                if index_name and index_name in existing:
                    continue
                model = IndexModel(keys, **kwargs)
                models.append(model)
            if models:
                await db[collection_name].create_indexes(models)
                for m in models:
                    logger.info(
                        "Created index %s on %s",
                        m.document.get("name"),
                        collection_name,
                    )
        except Exception as e:
            logger.warning("Failed to create indexes on %s: %s", collection_name, e)

    # TTL indexes for token cleanup
    ttl_collections = [
        ("password_reset_tokens", "expires_at"),
        ("email_verification_tokens", "expires_at"),
    ]
    for coll_name, field in ttl_collections:
        try:
            existing = await db[coll_name].index_information()
            if f"{field}_1" not in existing:
                await db[coll_name].create_index(field, expireAfterSeconds=0, name=f"{field}_ttl")
                logger.info("Created TTL index on %s.%s", coll_name, field)
        except Exception as e:
            logger.warning("Failed to create TTL index on %s: %s", coll_name, e)
