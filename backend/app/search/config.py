import asyncio
import logging

from meilisearch import Client

from app.core.config import settings

logger = logging.getLogger(__name__)

PUBLIC_DIARIES_INDEX = "public_diaries"

INDEX_SETTINGS = {
    "searchableAttributes": ["title", "content_text", "tags"],
    "filterableAttributes": [
        "tags", "emotion", "year", "month", "author_id", "created_at"
    ],
    "sortableAttributes": [
        "created_at", "updated_at", "like_count", "comment_count"
    ],
    "rankingRules": [
        "words", "typo", "proximity", "attribute", "sort", "exactness"
    ],
}

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(settings.meilisearch_url, settings.meilisearch_api_key)
    return _client


async def initialize_search_indexes() -> None:
    try:
        client = get_client()
        def _setup():
            try:
                index = client.get_index(PUBLIC_DIARIES_INDEX)
            except Exception:
                index = client.create_index(PUBLIC_DIARIES_INDEX, {"primaryKey": "id"})
            index.update_settings(INDEX_SETTINGS)
            return index
        await asyncio.to_thread(_setup)
        logger.info("Meilisearch index '%s' initialized", PUBLIC_DIARIES_INDEX)
    except Exception:
        logger.warning("Meilisearch not available — search will be unavailable")
