import asyncio
import logging

from app.repositories.user_repo import UserRepository
from app.search.config import PUBLIC_DIARIES_INDEX, get_client
from app.search.enricher import enrich_search_results

logger = logging.getLogger(__name__)


def _run_search(index, q: str, search_params: dict) -> dict:
    return index.search(q, search_params)


async def search_diaries(
    q: str = "",
    tags: str | None = None,
    emotion: str | None = None,
    year: int | None = None,
    month: int | None = None,
    sort: str = "created_at:desc",
    page: int = 1,
    per_page: int = 20,
    author_username: str | None = None,
    current_user: dict | None = None,
) -> dict:
    filters: list[str] = []

    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            tag_filters = [f"tags = {t}" for t in tag_list]
            filters.append(f"({' OR '.join(tag_filters)})")

    if emotion:
        filters.append(f"emotion = {emotion}")

    if year is not None:
        filters.append(f"year = {year}")

    if month is not None:
        filters.append(f"month = {month}")

    if author_username:
        user_repo = UserRepository()
        author = await user_repo.get_by_username(author_username)
        if author:
            filters.append(f"author_id = {author['_id']}")
        else:
            return {
                "data": [],
                "meta": {
                    "page": 1, "per_page": per_page, "total": 0,
                    "has_next": False, "has_prev": False,
                    "processing_time_ms": 0,
                },
            }

    filter_expression = " AND ".join(filters) if filters else None

    sort_field, sort_order = sort.split(":") if ":" in sort else (sort, "desc")
    sort_param = [{sort_field: sort_order}]

    try:
        index = get_client().index(PUBLIC_DIARIES_INDEX)
    except Exception:
        logger.warning("Meilisearch client unavailable")
        return {
            "data": [],
            "meta": {
                "page": 1, "per_page": per_page, "total": 0,
                "has_next": False, "has_prev": False,
                "processing_time_ms": 0,
            },
        }

    search_params = {
        "filter": filter_expression,
        "sort": sort_param,
        "page": page,
        "hitsPerPage": per_page,
        "attributesToHighlight": ["title", "content_text"],
        "attributesToCrop": [{"attribute": "content_text", "cropLength": 300}],
    }

    try:
        result = await asyncio.to_thread(_run_search, index, q or "", search_params)
    except Exception:
        logger.warning("Meilisearch search failed")
        return {
            "data": [],
            "meta": {
                "page": 1, "per_page": per_page, "total": 0,
                "has_next": False, "has_prev": False,
                "processing_time_ms": 0,
            },
        }

    enriched = await enrich_search_results(result["hits"], current_user)

    return {
        "data": enriched,
        "meta": {
            "page": result.get("page", page),
            "per_page": result.get("hitsPerPage", per_page),
            "total": result.get("totalHits", 0),
            "has_next": result.get("page", 1) < result.get("totalPages", 1),
            "has_prev": result.get("page", 1) > 1,
            "processing_time_ms": result.get("processingTimeMs", 0),
        },
    }
