import asyncio
import io
import logging
import uuid
from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.core.config import settings
from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.core.media_validator import (
    detect_mime_type,
    get_max_size,
    is_allowed_mime,
    mime_category,
    MAX_HEIGHT,
    MAX_PIXELS,
    MAX_WIDTH,
)
from app.core.minio_client import get_minio_client
from app.core.utils import fmt_dt
from app.repositories.media_repo import MediaRepository
from app.services.image_service import process_image, get_image_dimensions

logger = logging.getLogger(__name__)

SIGNED_URL_EXPIRY = timedelta(minutes=15)


def _generate_stored_path(user_id: str, filename: str) -> str:
    return f"users/{user_id}/{uuid.uuid4().hex}/{filename}"


def _generate_signed_url(stored_path: str) -> str:
    client = get_minio_client()
    url = client.presigned_get_object(
        settings.minio_bucket,
        stored_path,
        expires=SIGNED_URL_EXPIRY,
    )
    return url


async def _upload_object_async(stored_path: str, data: bytes, content_type: str) -> None:
    try:
        client = get_minio_client()
        from app.core.config import settings
        exists = await asyncio.to_thread(lambda: client.bucket_exists(settings.minio_bucket))
        if not exists:
            await asyncio.to_thread(lambda: client.make_bucket(settings.minio_bucket))
        await asyncio.to_thread(
            lambda: client.put_object(
                settings.minio_bucket,
                stored_path,
                io.BytesIO(data),
                length=len(data),
                content_type=content_type,
            )
        )
    except Exception as e:
        logger.exception("MinIO upload failed for %s", stored_path)
        raise


def _delete_object_sync(stored_path: str) -> bool:
    try:
        client = get_minio_client()
        client.remove_object(settings.minio_bucket, stored_path)
        return True
    except Exception:
        logger.warning("Failed to delete MinIO object: %s", stored_path, exc_info=True)
        return False


async def _delete_object_async(stored_path: str) -> bool:
    return await asyncio.to_thread(_delete_object_sync, stored_path)


def _build_media_response(media: dict, include_signed_url: bool = False) -> dict:
    result = {
        "id": str(media["_id"]),
        "user_id": str(media["user_id"]),
        "diary_id": str(media["diary_id"]) if media.get("diary_id") else None,
        "filename": media["filename"],
        "mime_type": media["mime_type"],
        "size_bytes": media["size_bytes"],
        "width": media.get("width"),
        "height": media.get("height"),
        "is_private": media.get("is_private", False),
        "created_at": fmt_dt(media.get("created_at")),
    }
    stored_path = media["stored_path"]
    if include_signed_url or media.get("is_private"):
        result["url"] = _generate_signed_url(stored_path)
    else:
        result["url"] = f"{settings.minio_endpoint}/{settings.minio_bucket}/{stored_path}"

    thumbnail_path = media.get("thumbnail_path")
    if thumbnail_path:
        if include_signed_url or media.get("is_private"):
            result["thumbnail_url"] = _generate_signed_url(thumbnail_path)
        else:
            result["thumbnail_url"] = (
                f"{settings.minio_endpoint}/{settings.minio_bucket}/{thumbnail_path}"
            )

    standard_path = media.get("standard_path")
    if standard_path:
        if include_signed_url or media.get("is_private"):
            result["standard_url"] = _generate_signed_url(standard_path)
        else:
            result["standard_url"] = (
                f"{settings.minio_endpoint}/{settings.minio_bucket}/{standard_path}"
            )

    return result


async def upload_media(
    user: dict,
    file_data: bytes,
    original_filename: str,
    content_type_header: str | None = None,
    diary_id: str | None = None,
    is_private: bool = False,
) -> dict:
    if user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    repo = MediaRepository()
    user_count = await repo.count_by_user(str(user["_id"]))
    if user_count >= settings.max_media_per_user:
        raise ValidationException(
            f"Media limit reached ({settings.max_media_per_user} files)"
        )

    if diary_id:
        diary_count = await repo.count_by_user(str(user["_id"]), diary_id=diary_id)
        if diary_count >= settings.max_media_per_diary:
            raise ValidationException(
                f"Media limit per diary reached ({settings.max_media_per_diary} files)"
            )

    detected_mime = detect_mime_type(file_data)
    logger.info(
        "Upload detected_mime=%s content_type_header=%s filename=%s size=%d",
        detected_mime, content_type_header, original_filename, len(file_data),
    )

    if detected_mime is None:
        raise ValidationException(
            "Unsupported file type. Allowed types: JPEG, PNG, WebP, GIF, AVIF, MP4, MP3, OGG, WAV"
        )

    if not is_allowed_mime(detected_mime):
        raise ValidationException(
            f"File type '{detected_mime}' is not allowed. "
            "Allowed types: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MP3, OGG, WAV, M4A"
        )

    max_size = get_max_size(detected_mime)
    if max_size > 0 and len(file_data) > max_size:
        size_mb = max_size / (1024 * 1024)
        raise ValidationException(
            f"File exceeds maximum size of {size_mb:.0f} MB"
            f" for {mime_category(detected_mime)} files"
        )

    width: int | None = None
    height: int | None = None

    category = mime_category(detected_mime)

    if category == "image":
        try:
            w, h = get_image_dimensions(file_data)
            width, height = w, h
        except Exception as e:
            raise ValidationException(f"Invalid or corrupted image: {e}") from e

        if width > MAX_WIDTH or height > MAX_HEIGHT:
            raise ValidationException(
                f"Image dimensions {width}x{height} exceed maximum {MAX_WIDTH}x{MAX_HEIGHT}"
            )
        if width * height > MAX_PIXELS:
            raise ValidationException(
                f"Image pixel count {width * height} exceeds maximum {MAX_PIXELS}"
            )

    now = datetime.now(UTC)
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
    if category == "image":
        ext = "webp"
    base_path = f"users/{str(user['_id'])}/{uuid.uuid4().hex}"
    diary_oid = ObjectId(diary_id) if diary_id and ObjectId.is_valid(diary_id) else None

    if category == "image":
        variants = process_image(file_data)
        stored_path = f"{base_path}.webp"
        await _upload_object_async(stored_path, variants["original"], "image/webp")

        standard_path = f"{base_path}_std.webp"
        await _upload_object_async(standard_path, variants["standard"], "image/webp")

        thumb_path = f"{base_path}_thumb.webp"
        await _upload_object_async(thumb_path, variants["thumbnail"], "image/webp")

        original_mime = detected_mime
        size_bytes = len(variants["original"])

        media_doc = {
            "user_id": user["_id"],
            "diary_id": diary_oid,
            "filename": original_filename,
            "stored_path": stored_path,
            "standard_path": standard_path,
            "thumbnail_path": thumb_path,
            "mime_type": "image/webp",
            "original_mime_type": original_mime,
            "size_bytes": size_bytes,
            "width": width,
            "height": height,
            "is_private": is_private,
            "created_at": now,
        }
    else:
        ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
        stored_path = f"{base_path}.{ext}"
        await _upload_object_async(stored_path, file_data, detected_mime)

        media_doc = {
            "user_id": user["_id"],
            "diary_id": diary_oid,
            "filename": original_filename,
            "stored_path": stored_path,
            "mime_type": detected_mime,
            "size_bytes": len(file_data),
            "width": width,
            "height": height,
            "is_private": is_private,
            "created_at": now,
        }

    try:
        repo = MediaRepository()
        media_id = await repo.create(media_doc)
    except Exception:
        await _delete_object_async(stored_path)
        if category == "image":
            standard_path_inner = media_doc.get("standard_path")
            thumb_path_inner = media_doc.get("thumbnail_path")
            if standard_path_inner:
                await _delete_object_async(standard_path_inner)
            if thumb_path_inner:
                await _delete_object_async(thumb_path_inner)
        raise

    result = await repo.get_by_id(str(media_id))
    if result is None:
        raise NotFoundException("Media record not found after creation")

    return _build_media_response(result, include_signed_url=is_private)


async def delete_media(media_id: str, current_user: dict) -> None:
    repo = MediaRepository()
    media = await repo.get_by_id(media_id)
    if media is None:
        raise NotFoundException("Media not found")

    is_owner = str(media["user_id"]) == str(current_user["_id"])
    is_admin = current_user.get("is_admin", False)
    if not is_owner and not is_admin:
        raise PermissionDeniedException("You do not own this media")

    for path_key in ("stored_path", "standard_path", "thumbnail_path"):
        path_val = media.get(path_key)
        if path_val:
            await _delete_object_async(path_val)

    await repo.delete(media_id)


async def get_media_gallery(
    user_id: str,
    page: int = 1,
    per_page: int = 20,
    diary_id: str | None = None,
) -> dict:
    repo = MediaRepository()
    skip = (page - 1) * per_page
    media_list = await repo.find_by_user(
        user_id, diary_id=diary_id, skip=skip, limit=per_page
    )
    total = await repo.count_by_user(user_id, diary_id=diary_id)

    data = []
    for m in media_list:
        data.append(_build_media_response(m, include_signed_url=bool(m.get("is_private"))))

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


async def get_media_detail(media_id: str) -> dict:
    repo = MediaRepository()
    media = await repo.get_by_id(media_id)
    if media is None:
        raise NotFoundException("Media not found")
    return _build_media_response(media, include_signed_url=bool(media.get("is_private")))


async def get_media_signed_url(media_id: str, current_user: dict) -> dict:
    repo = MediaRepository()
    media = await repo.get_by_id(media_id)
    if media is None:
        raise NotFoundException("Media not found")

    is_owner = str(media["user_id"]) == str(current_user["_id"])
    if not is_owner:
        raise PermissionDeniedException("You do not own this media")

    url = _generate_signed_url(media["stored_path"])
    result = {
        "url": url,
        "id": str(media["_id"]),
        "mime_type": media["mime_type"],
        "expires_in_seconds": int(SIGNED_URL_EXPIRY.total_seconds()),
    }
    if media.get("thumbnail_path"):
        result["thumbnail_url"] = _generate_signed_url(media["thumbnail_path"])
    if media.get("standard_path"):
        result["standard_url"] = _generate_signed_url(media["standard_path"])
    return result


async def cascade_delete_diary_media(diary_id: str) -> int:
    repo = MediaRepository()
    media_list = await repo.find_by_diary(diary_id)
    for m in media_list:
        for path_key in ("stored_path", "standard_path", "thumbnail_path"):
            path_val = m.get(path_key)
            if path_val:
                await _delete_object_async(path_val)
    deleted = await repo.delete_by_diary(diary_id)
    return deleted
