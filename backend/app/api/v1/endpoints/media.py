import hashlib
import re

from fastapi import APIRouter, Depends, Query, Request, Response, UploadFile
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, get_optional_current_user
from app.core.config import settings
from app.core.exceptions import RateLimitException, ValidationException
from app.core.security import check_rate_limit
from app.services.media_service import (
    delete_media,
    fetch_media_object,
    get_media_detail,
    get_media_gallery,
    get_media_object_size,
    get_media_signed_url,
    resolve_media_file,
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
    is_limited, _ = await check_rate_limit(f"rate_limit:upload_media:{current_user['_id']}", 10, 60)
    if is_limited:
        raise RateLimitException("Too many upload attempts")

    is_daily_limited, _ = await check_rate_limit(
        f"rate_limit:daily_upload:{current_user['_id']}", settings.max_daily_uploads, 86400
    )
    if is_daily_limited:
        raise RateLimitException(f"Daily upload limit reached ({settings.max_daily_uploads} files)")

    content_length = request.headers.get("content-length")
    if (
        content_length
        and content_length.isdigit()
        and int(content_length) > MAX_UPLOAD_SIZE + 1024 * 1024
    ):
        raise ValidationException(
            f"File exceeds maximum size of {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
        )

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_SIZE:
            raise ValidationException(
                f"File exceeds maximum size of {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
            )
        chunks.append(chunk)
    file_data = b"".join(chunks)
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
    page: int = Query(1, ge=1, le=1000),
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


@router.get("/file/{media_id}")
async def get_media_file(
    media_id: str,
    request: Request,
    variant: str = Query("original"),
    current_user: dict | None = Depends(get_optional_current_user),
):
    """Permanent, non-expiring media endpoint. Streams the stored object for
    public media (and private media for its owner/admin). Returned URLs are
    baked into diary HTML, so unlike signed URLs they never expire."""
    media, path, _is_private = await resolve_media_file(media_id, variant, current_user)
    etag = '"' + hashlib.sha256(
        f"{path}:{media.get('created_at', '')}".encode()
    ).hexdigest() + '"'
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=304,
            headers={"ETag": etag, "Cache-Control": "private, no-store"},
        )

    range_header = request.headers.get("range")
    range_start = range_end = total_size = None
    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match or (not match.group(1) and not match.group(2)) or "," in range_header:
            return Response(status_code=416, headers={"Content-Range": "bytes */*"})
        total_size = await get_media_object_size(path)
        if match.group(1):
            range_start = int(match.group(1))
            range_end = int(match.group(2)) if match.group(2) else total_size - 1
        else:
            suffix_length = int(match.group(2))
            range_start = max(total_size - suffix_length, 0)
            range_end = total_size - 1
        if range_start >= total_size or range_start > range_end:
            return Response(
                status_code=416,
                headers={"Content-Range": f"bytes */{total_size}"},
            )
        range_end = min(range_end, total_size - 1)
        obj = await fetch_media_object(path, range_start, range_end - range_start + 1)
    else:
        obj = await fetch_media_object(path)

    content_type = media.get("mime_type") or "application/octet-stream"

    def iter_chunks():
        try:
            yield from obj.stream(64 * 1024)
        finally:
            obj.close()
            obj.release_conn()

    headers = {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "ETag": etag,
        "Accept-Ranges": "bytes",
    }
    status_code = 200
    if range_start is not None and range_end is not None and total_size is not None:
        status_code = 206
        headers["Content-Range"] = f"bytes {range_start}-{range_end}/{total_size}"
        headers["Content-Length"] = str(range_end - range_start + 1)

    return StreamingResponse(
        iter_chunks(),
        media_type=content_type,
        # Visibility is mutable (public -> private, deletion, moderation).
        # Do not let a previously public response survive in a browser/CDN
        # cache after authorization changes.
        headers=headers,
        status_code=status_code,
    )


@router.get("/{media_id}")
async def get_media(media_id: str, current_user: dict = Depends(get_current_user)):
    result = await get_media_detail(media_id, current_user)
    return {"data": result}


@router.get("/{media_id}/url")
async def get_signed_url(
    media_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a stable media URL in the legacy response shape."""
    result = await get_media_signed_url(media_id, current_user)
    return {"data": result}


@router.delete("/{media_id}", status_code=204)
async def delete(
    media_id: str,
    current_user: dict = Depends(get_current_user),
):
    await delete_media(media_id, current_user)
