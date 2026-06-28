from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import _optional_user
from app.core.exceptions import RateLimitException
from app.core.security import check_rate_limit
from app.search.config import PUBLIC_DIARIES_INDEX, get_client
from app.search.sync import full_reindex
from app.services.search_service import search_diaries

router = APIRouter(tags=["search"])


@router.get("/search")
async def search(
    request: Request,
    q: str = Query(""),
    tags: str | None = Query(None),
    emotion: str | None = Query(None),
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    sort: str = Query("created_at:desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    author: str | None = Query(None),
    current_user: dict | None = Depends(_optional_user),
):
    if current_user:
        is_limited, _ = await check_rate_limit(
            f"rate_limit:search:{current_user['_id']}", 30, 60
        )
        if is_limited:
            raise RateLimitException("Too many search requests")
    else:
        client_ip = request.client.host if request.client else "unknown"
        is_limited, _ = await check_rate_limit(
            f"rate_limit:search:anon:{client_ip}", 60, 60
        )
        if is_limited:
            raise RateLimitException("Too many search requests")

    result = await search_diaries(
        q=q,
        tags=tags,
        emotion=emotion,
        year=year,
        month=month,
        sort=sort,
        page=page,
        per_page=per_page,
        author_username=author,
        current_user=current_user,
    )
    return result


@router.post("/search/reindex")
async def reindex():
    from app.core.database import DatabaseManager
    db = DatabaseManager.get_db()
    total = await db.diaries.count_documents({})
    public = await db.diaries.count_documents({"privacy": "public"})
    draft = await db.diaries.count_documents({"privacy": "draft"})
    private = await db.diaries.count_documents({"privacy": "private"})

    count = await full_reindex()
    return {
        "data": {
            "indexed": count,
            "db_counts": {"total": total, "public": public, "draft": draft, "private": private},
            "message": f"Re-indexed {count} public diaries",
        }
    }


@router.get("/search/health")
async def search_health():
    try:
        client = get_client()
        health = client.health()
        index = client.get_index(PUBLIC_DIARIES_INDEX)
        stats = index.get_stats()
        return {
            "data": {
                "meilisearch": health.get("status", "unknown"),
                "index": PUBLIC_DIARIES_INDEX,
                "documents": stats.number_of_documents,
            }
        }
    except Exception as e:
        return {
            "data": {
                "meilisearch": "unavailable",
                "error": str(e),
            }
        }
