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
    sort_param = [f"{sort_field}:{sort_order}"]

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
        "limit": per_page,
        "offset": (page - 1) * per_page,
        "attributesToHighlight": ["title", "content_text"],
        "attributesToCrop": ["content_text"],
    }
    if sort_field in ("created_at", "updated_at", "like_count", "comment_count"):
        search_params["sort"] = sort_param

    try:
        result = await asyncio.to_thread(_run_search, index, q or "", search_params)
    except Exception as e:
        logger.warning("Meilisearch search failed: %s", e)
        return {
            "data": [],
            "meta": {
                "page": 1, "per_page": per_page, "total": 0,
                "has_next": False, "has_prev": False,
                "processing_time_ms": 0,
            },
        }

    enriched = await enrich_search_results(result["hits"], current_user)

    total = result.get("estimatedTotalHits", 0)
    offset_val = result.get("offset", 0)
    limit_val = result.get("limit", per_page)

    return {
        "data": enriched,
        "meta": {
            "page": (offset_val // limit_val) + 1 if limit_val else 1,
            "per_page": limit_val,
            "total": total,
            "has_next": offset_val + limit_val < total,
            "has_prev": offset_val > 0,
            "processing_time_ms": result.get("processingTimeMs", 0),
        },
    }
