import logging

from pymongo import IndexModel

from app.core.database import DatabaseManager
from app.schemas import ALL_INDEXES

logger = logging.getLogger(__name__)


async def create_indexes() -> None:
    db = DatabaseManager.get_db()
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
            logger.warning(
                "Failed to create indexes on %s: %s", collection_name, e
            )
