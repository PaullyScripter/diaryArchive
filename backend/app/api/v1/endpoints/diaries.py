from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import get_current_user, _optional_user
from app.core.exceptions import RateLimitException, ValidationException
from app.core.security import check_rate_limit
from app.models.diary import DiaryCreate, DiaryUpdate
from app.services.diary_service import (
    create_diary,
    delete_diary,
    get_diary,
    get_my_diaries_stats,
    get_random_diary,
    list_my_diaries,
    list_public_diaries,
    update_diary,
)

router = APIRouter(prefix="/diaries", tags=["diaries"])


@router.post("", status_code=201)
async def create(
    body: DiaryCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:create_diary:{current_user['_id']}", 30, 60
    )
    if is_limited:
        raise RateLimitException("Too many diary creation attempts")
    result = await create_diary(current_user, body.model_dump())
    return {"data": result}


@router.get("")
async def list_diaries(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort: str = Query("latest"),
    order: str = Query("desc"),
    tags: str | None = Query(None),
    emotion: str | None = Query(None),
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    current_user: dict | None = Depends(_optional_user),
):
    if month is not None and year is None:
        raise ValidationException("Year is required when filtering by month")
    result = await list_public_diaries(
        current_user=current_user,
        page=page,
        per_page=per_page,
        sort=sort,
        order=order,
        tags=tags,
        emotion=emotion,
        year=year,
        month=month,
    )
    return result


@router.get("/random")
async def random_diary(current_user: dict | None = Depends(_optional_user)):
    diary = await get_random_diary(current_user)
    return {"data": diary}


@router.get("/{diary_id}")
async def get_one(
    diary_id: str,
    current_user: dict | None = Depends(_optional_user),
):
    diary = await get_diary(diary_id, current_user)
    return {"data": diary}


@router.put("/{diary_id}")
async def update(
    diary_id: str,
    body: DiaryUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:update_diary:{current_user['_id']}", 30, 60
    )
    if is_limited:
        raise RateLimitException("Too many diary update attempts")
    updates = body.model_dump(exclude_unset=True, exclude_none=False)
    result = await update_diary(diary_id, updates, current_user)
    return {"data": result}


@router.delete("/{diary_id}", status_code=204)
async def delete(
    diary_id: str,
    current_user: dict = Depends(get_current_user),
):
    await delete_diary(diary_id, current_user)
