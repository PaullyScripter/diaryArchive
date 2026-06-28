from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import _optional_user
from app.core.exceptions import RateLimitException
from app.core.security import check_rate_limit
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
