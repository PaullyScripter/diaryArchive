from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.services.diary_service import get_my_diaries_stats, list_my_diaries

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/diaries")
async def my_diaries(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    privacy: str | None = Query(None),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
    current_user: dict = Depends(get_current_user),
):
    result = await list_my_diaries(
        current_user,
        page=page,
        per_page=per_page,
        privacy=privacy,
        sort=sort,
        order=order,
    )
    return result


@router.get("/diaries/stats")
async def my_diary_stats(
    current_user: dict = Depends(get_current_user),
):
    stats = await get_my_diaries_stats(str(current_user["_id"]))
    return {"data": stats}
