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
_INDEX_INFO_METADATA = frozenset({"key", "name", "ns", "v"})


def _index_spec_matches(existing: dict, model: IndexModel) -> bool:
    """Return whether an existing Mongo index satisfies an IndexModel.

    Index names are not part of an index's behavior. Older installations may
    therefore have a valid index under a historical name; trying to create the
    same key/options under the newer name produces ``IndexOptionsConflict`` and
    prevents the application from starting.
    """
    existing_keys = tuple(tuple(item) for item in existing.get("key", []))
    desired_keys = tuple(model.document.get("key", {}).items())
    if existing_keys != desired_keys:
        return False

    existing_options = {
        key: value for key, value in existing.items() if key not in _INDEX_INFO_METADATA
    }
    desired_options = {
        key: value for key, value in model.document.items() if key not in {"key", "name"}
    }
    return existing_options == desired_options


async def remove_incompatible_report_indexes() -> list[str]:
    """Remove pre-hardening report indexes that used unsupported ``$ne``."""
    db = DatabaseManager.get_db()
    existing = await db.reports.index_information()
    index = existing.get("idx_pending_target_unique")
    partial = index.get("partialFilterExpression", {}) if index else {}
    target_filter = partial.get("target_type", {}) if isinstance(partial, dict) else {}
    if isinstance(target_filter, dict) and "$ne" in target_filter:
        await db.reports.drop_index("idx_pending_target_unique")
        logger.warning("Removed incompatible report partial index idx_pending_target_unique")
        return ["reports.idx_pending_target_unique"]
    return []


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
    failures: list[str] = []
    try:
        await remove_obsolete_media_indexes()
    except Exception as e:
        failures.append(f"media obsolete indexes: {e}")
        logger.error("Failed to remove obsolete media indexes: %s", e)
    try:
        await remove_obsolete_retention_indexes()
    except Exception as e:
        failures.append(f"retention obsolete indexes: {e}")
        logger.error("Failed to remove obsolete retention indexes: %s", e)
    try:
        await remove_incompatible_report_indexes()
    except Exception as e:
        failures.append(f"report obsolete indexes: {e}")
        logger.error("Failed to remove incompatible report indexes: %s", e)

    for collection_name, indexes in ALL_INDEXES.items():
        try:
            existing = await db[collection_name].index_information()
            models: list[IndexModel] = []
            for keys, kwargs in indexes:
                model = IndexModel(keys, **kwargs)
                index_name = kwargs.get("name", "")
                if (
                    index_name
                    and index_name in existing
                    and not _index_spec_matches(existing[index_name], model)
                ):
                    await db[collection_name].drop_index(index_name)
                    del existing[index_name]
                    logger.warning(
                        "Replaced incompatible index %s on %s",
                        index_name,
                        collection_name,
                    )
                matching_name = next(
                    (
                        existing_name
                        for existing_name, existing_info in existing.items()
                        if _index_spec_matches(existing_info, model)
                    ),
                    None,
                )
                if matching_name is not None:
                    desired_name = kwargs.get("name", "")
                    if desired_name != matching_name:
                        logger.info(
                            "Using compatible existing index %s on %s for required name %s",
                            matching_name,
                            collection_name,
                            desired_name,
                        )
                    continue
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
            failures.append(f"{collection_name}: {e}")
            logger.warning("Failed to create indexes on %s: %s", collection_name, e)

    if failures:
        raise RuntimeError(f"Required MongoDB indexes could not be reconciled: {failures}")
