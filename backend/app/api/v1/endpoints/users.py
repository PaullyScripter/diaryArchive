from datetime import datetime

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import _optional_user, get_current_user
from app.core.exceptions import NotFoundException, RateLimitException
from app.core.security import check_rate_limit
from app.models.user import EmailUpdate, EncryptionKeyUpdate, UserUpdate
from app.repositories.diary_repo import DiaryRepository
from app.repositories.user_repo import UserRepository
from app.services.user_service import (
    get_user_profile,
    update_encryption_key,
    update_user_email,
    update_user_profile,
)

router = APIRouter(prefix="/users", tags=["users"])


def _fmt_dt(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


@router.get("/{username}")
async def get_profile(
    username: str,
    current_user: dict | None = Depends(_optional_user),
):
    profile = await get_user_profile(username, current_user)
    return {"data": profile}


@router.put("/me")
async def update_my_profile(
    body: UserUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:update_profile:{current_user['_id']}", 30, 60
    )
    if is_limited:
        raise RateLimitException("Too many profile updates")
    update_dict = body.model_dump(exclude_unset=True, exclude_none=False)
    profile = await update_user_profile(str(current_user["_id"]), update_dict)
    return {"data": profile}


@router.put("/me/email")
async def update_my_email(
    body: EmailUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:update_email:{current_user['_id']}", 5, 60
    )
    if is_limited:
        raise RateLimitException("Too many email update attempts")
    result = await update_user_email(str(current_user["_id"]), body.email)
    return {"data": result}


@router.put("/me/encryption-key")
async def update_encryption_key_endpoint(
    body: EncryptionKeyUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    result = await update_encryption_key(
        str(current_user["_id"]),
        body.encrypted_master_key,
        body.master_key_salt,
    )
    return {"data": result}


@router.get("/me/encryption-key")
async def get_encryption_key(
    current_user: dict = Depends(get_current_user),
):
    return {
        "data": {
            "encrypted_master_key": current_user.get("encrypted_master_key"),
            "master_key_salt": current_user.get("master_key_salt"),
            "has_master_key": bool(current_user.get("encrypted_master_key")),
        }
    }


@router.get("/{username}/diaries")
async def get_user_diaries(
    username: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
):
    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)
    if user is None:
        raise NotFoundException("User not found")

    sort_field = sort if sort in ("created_at", "updated_at") else "created_at"
    sort_dir = -1 if order == "desc" else 1
    skip = (page - 1) * per_page

    diary_repo = DiaryRepository()
    diaries = await diary_repo.find_public_by_user(
        str(user["_id"]),
        sort=[(sort_field, sort_dir)],
        skip=skip,
        limit=per_page,
    )
    total = await diary_repo.count_public_by_user(str(user["_id"]))

    data = []
    for diary in diaries:
        content_text = diary.get("content_text", "") or ""
        data.append({
            "id": str(diary["_id"]),
            "title": diary.get("title"),
            "excerpt": content_text[:200] if content_text else None,
            "tags": diary.get("tags", []),
            "emotion": diary.get("emotion"),
            "stats": diary.get("stats", {
                "like_count": 0,
                "comment_count": 0,
                "bookmark_count": 0,
            }),
            "created_at": _fmt_dt(diary.get("created_at")),
            "updated_at": _fmt_dt(diary.get("updated_at")),
            "published_at": _fmt_dt(diary.get("published_at")),
        })

    return {
        "data": data,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": (page * per_page) < total,
            "has_prev": page > 1,
        },
    }
