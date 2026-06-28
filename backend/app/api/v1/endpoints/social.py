from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import _optional_user, get_current_user
from app.core.exceptions import RateLimitException
from app.core.security import check_rate_limit
from app.services.social_service import (
    list_followers,
    list_following,
    list_my_bookmarks,
    list_my_likes,
    toggle_bookmark,
    toggle_follow,
    toggle_like,
)

router = APIRouter(tags=["social"])


@router.post("/diaries/{diary_id}/like")
async def like_diary(
    diary_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:toggle_like:{current_user['_id']}", 30, 60
    )
    if is_limited:
        raise RateLimitException("Too many like attempts")
    result = await toggle_like(diary_id, current_user)
    return {"data": result}


@router.post("/diaries/{diary_id}/bookmark")
async def bookmark_diary(
    diary_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:toggle_bookmark:{current_user['_id']}", 30, 60
    )
    if is_limited:
        raise RateLimitException("Too many bookmark attempts")
    result = await toggle_bookmark(diary_id, current_user)
    return {"data": result}


@router.post("/users/{username}/follow")
async def follow_user(
    username: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:toggle_follow:{current_user['_id']}", 20, 60
    )
    if is_limited:
        raise RateLimitException("Too many follow attempts")
    result = await toggle_follow(username, current_user)
    return {"data": result}


@router.get("/users/{username}/followers")
async def get_followers(
    username: str,
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    auth_header = request.headers.get("Authorization", "")
    current_user = None
    if auth_header:
        current_user = await _optional_user(authorization=auth_header)
    result = await list_followers(username, page=page, per_page=per_page, current_user=current_user)
    return result


@router.get("/users/{username}/following")
async def get_following(
    username: str,
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    auth_header = request.headers.get("Authorization", "")
    current_user = None
    if auth_header:
        current_user = await _optional_user(authorization=auth_header)
    result = await list_following(username, page=page, per_page=per_page, current_user=current_user)
    return result


@router.get("/me/likes")
async def get_my_likes(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    result = await list_my_likes(current_user, page=page, per_page=per_page)
    return result


@router.get("/me/bookmarks")
async def get_my_bookmarks(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    result = await list_my_bookmarks(current_user, page=page, per_page=per_page)
    return result
