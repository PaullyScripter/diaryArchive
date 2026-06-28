from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import _optional_user, get_current_user
from app.core.exceptions import RateLimitException
from app.core.security import check_rate_limit
from app.models.comment import CommentCreate
from app.services.comment_service import (
    create_comment,
    delete_comment,
    list_comments,
    list_replies,
    toggle_comment_like,
)

router = APIRouter(tags=["comments"])


@router.post("/diaries/{diary_id}/comments", status_code=201)
async def create(
    diary_id: str,
    body: CommentCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:create_comment:{current_user['_id']}", 10, 60
    )
    if is_limited:
        raise RateLimitException("Too many comment attempts")
    result = await create_comment(diary_id, body.content, current_user, parent_comment_id=body.parent_comment_id)
    return {"data": result}


@router.get("/diaries/{diary_id}/comments")
async def list_all(
    diary_id: str,
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=50),
):
    auth_header = request.headers.get("Authorization", "")
    current_user = None
    if auth_header:
        current_user = await _optional_user(authorization=auth_header)
    result = await list_comments(diary_id, page=page, per_page=per_page, current_user=current_user)
    return result


@router.get("/comments/{comment_id}/replies")
async def get_replies(
    comment_id: str,
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    auth_header = request.headers.get("Authorization", "")
    current_user = None
    if auth_header:
        current_user = await _optional_user(authorization=auth_header)
    result = await list_replies(comment_id, page=page, per_page=per_page, current_user=current_user)
    return result


@router.post("/comments/{comment_id}/like")
async def like_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await toggle_comment_like(comment_id, current_user)
    return {"data": result}


@router.delete("/diaries/{diary_id}/comments/{comment_id}", status_code=204)
async def delete(
    diary_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user),
):
    await delete_comment(comment_id, current_user)
