from fastapi import APIRouter, Depends, Query, Request, UploadFile

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.exceptions import RateLimitException, ValidationException
from app.core.security import check_rate_limit
from app.services.media_service import (
    delete_media,
    get_media_detail,
    get_media_gallery,
    get_media_signed_url,
    upload_media,
)

router = APIRouter(prefix="/media", tags=["media"])

MAX_UPLOAD_SIZE = 50 * 1024 * 1024


@router.post("/upload", status_code=201)
async def upload(
    file: UploadFile,
    request: Request,
    diary_id: str | None = None,
    is_private: bool = False,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:upload_media:{current_user['_id']}", 10, 60
    )
    if is_limited:
        raise RateLimitException("Too many upload attempts")

    is_daily_limited, _ = await check_rate_limit(
        f"rate_limit:daily_upload:{current_user['_id']}", settings.max_daily_uploads, 86400
    )
    if is_daily_limited:
        raise RateLimitException(f"Daily upload limit reached ({settings.max_daily_uploads} files)")

    file_data = await file.read()
    if len(file_data) > MAX_UPLOAD_SIZE:
        raise ValidationException(
            f"File exceeds maximum size of {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
        )
    if len(file_data) == 0:
        raise ValidationException("Empty file not allowed")

    result = await upload_media(
        user=current_user,
        file_data=file_data,
        original_filename=file.filename or "untitled",
        content_type_header=file.content_type,
        diary_id=diary_id,
        is_private=is_private,
    )
    return {"data": result}


@router.get("")
async def gallery(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    diary_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    result = await get_media_gallery(
        user_id=str(current_user["_id"]),
        page=page,
        per_page=per_page,
        diary_id=diary_id,
    )
    return result


@router.get("/{media_id}")
async def get_media(media_id: str, current_user: dict = Depends(get_current_user)):
    result = await get_media_detail(media_id, current_user)
    return {"data": result}


@router.get("/{media_id}/url")
async def get_signed_url(
    media_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await get_media_signed_url(media_id, current_user)
    return {"data": result}


@router.delete("/{media_id}", status_code=204)
async def delete(
    media_id: str,
    current_user: dict = Depends(get_current_user),
):
    await delete_media(media_id, current_user)
