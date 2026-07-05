from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.services.achievement_service import (
    get_displayed_badge,
    get_user_achievements,
    set_displayed_badge,
)

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("")
async def list_achievements(current_user: dict = Depends(get_current_user)):
    achievements = await get_user_achievements(str(current_user["_id"]))
    return {"data": achievements}


@router.put("/display/{achievement_id}")
async def set_badge(achievement_id: str, current_user: dict = Depends(get_current_user)):
    badge = await set_displayed_badge(str(current_user["_id"]), achievement_id)
    return {"data": badge or {}}
