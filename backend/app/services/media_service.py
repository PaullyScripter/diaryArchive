import asyncio
import io
import logging
import uuid
from datetime import UTC, datetime

from bson import ObjectId

from app.core.config import settings
from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.core.media_validator import (
    MAX_HEIGHT,
    MAX_PIXELS,
    MAX_WIDTH,
    detect_mime_type,
    get_max_size,
    is_allowed_mime,
    mime_category,
)
from app.core.minio_client import get_minio_client
from app.core.utils import fmt_dt
from app.repositories.diary_repo import DiaryRepository
from app.repositories.media_repo import MediaRepository
from app.services.image_service import get_image_dimensions, process_image

logger = logging.getLogger(__name__)

_MAX_FILENAME_LEN = 255


def _sanitize_filename(filename: str) -> str:
    safe = "".join(c for c in filename if c.isalnum() or c in " ._-()")
    safe = safe.strip()
    if not safe:
        safe = "untitled"
    return safe[:_MAX_FILENAME_LEN]


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
    except Exception:
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


def _permanent_media_url(
    media_id: str, stored_path: str, variant: str, allow_public_base: bool = True
) -> str:
    """Return a non-expiring, browser-resolvable URL for public media.

    Prefers a configured public/CDN base URL. When none is configured, falls
    back to the app's own media proxy endpoint, which streams the object on
    demand and never expires (unlike short-lived signed URLs that get baked
    into diary HTML and then break).
    """
    base = settings.public_media_base_url
    if base and allow_public_base:
        return f"{base.rstrip('/')}/{settings.minio_bucket}/{stored_path}"
    return f"/api/v1/media/file/{media_id}?v={variant}"


def _build_media_response(
    media: dict,
    include_signed_url: bool = False,
    effective_is_private: bool | None = None,
) -> dict:
    # Missing privacy metadata is treated as private. This is fail-closed for
    # records created by older versions of the application.
    stored_is_private = (
        bool(media.get("is_private", True))
        if effective_is_private is None
        else effective_is_private
    )
    result = {
        "id": str(media["_id"]),
        "user_id": str(media["user_id"]),
        "diary_id": str(media["diary_id"]) if media.get("diary_id") else None,
        "filename": media["filename"],
        "mime_type": media["mime_type"],
        "size_bytes": media["size_bytes"],
        "width": media.get("width"),
        "height": media.get("height"),
        "is_private": stored_is_private,
        "created_at": fmt_dt(media.get("created_at")),
    }
    media_id = str(media["_id"])
    stored_path = media["stored_path"]
    # Stable proxy URLs are returned for every media visibility. Private media
    # cannot safely expose a MinIO signed URL to browser HTML, and the proxy
    # performs the current authorization check at request time.
    result["url"] = _permanent_media_url(
        media_id, stored_path, "original", allow_public_base=not stored_is_private
    )

    thumbnail_path = media.get("thumbnail_path")
    if thumbnail_path:
        result["thumbnail_url"] = _permanent_media_url(
            media_id, thumbnail_path, "thumb", allow_public_base=not stored_is_private
        )

    standard_path = media.get("standard_path")
    if standard_path:
        result["standard_url"] = _permanent_media_url(
            media_id, standard_path, "standard", allow_public_base=not stored_is_private
        )

    return result


async def resolve_media_file(
    media_id: str, variant: str, current_user: dict | None
) -> tuple[dict, str, bool]:
    """Resolve a media record + object path for the streaming proxy endpoint.

    Private media is only served to its owner or an admin; public media is
    served to anyone (required so public diary images render without auth).
    """
    repo = MediaRepository()
    media = await repo.get_by_id(media_id)
    if media is None:
        raise NotFoundException("Media not found")

    effective_is_private = bool(media.get("is_private", True))
    if media.get("diary_id"):
        diary = await DiaryRepository().get_by_id(str(media["diary_id"]))
        # An orphaned association must never become public.
        effective_is_private = diary is None or diary.get("privacy") != "public"

    if effective_is_private:
        is_owner = bool(current_user) and str(media["user_id"]) == str(current_user["_id"])
        is_admin = bool(current_user and current_user.get("is_admin"))
        if not is_owner and not is_admin:
            raise NotFoundException("Media not found")

    path_key = {
        "original": "stored_path",
        "standard": "standard_path",
        "thumb": "thumbnail_path",
    }.get(variant, "stored_path")
    path = media.get(path_key)
    if not path:
        raise NotFoundException("Media variant not found")

    return media, path, effective_is_private


async def fetch_media_object(path: str):
    """Open the stored object for streaming, or raise 404 if it is gone."""
    client = get_minio_client()
    try:
        return await asyncio.to_thread(client.get_object, settings.minio_bucket, path)
    except Exception:
        raise NotFoundException("Media not found")


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

    safe_filename = _sanitize_filename(original_filename)

    repo = MediaRepository()
    user_count = await repo.count_by_user(str(user["_id"]))
    if user_count >= settings.max_media_per_user:
        raise ValidationException(f"Media limit reached ({settings.max_media_per_user} files)")

    effective_is_private = True  # unattached/draft media is private by default
    if diary_id:
        diary_repo = DiaryRepository()
        diary = await diary_repo.get_by_id(diary_id)
        if diary is None or str(diary.get("user_id")) != str(user["_id"]):
            raise PermissionDeniedException("You do not own this diary")
        effective_is_private = diary.get("privacy") != "public"

        diary_count = await repo.count_by_user(str(user["_id"]), diary_id=diary_id)
        if diary_count >= settings.max_media_per_diary:
            raise ValidationException(
                f"Media limit per diary reached ({settings.max_media_per_diary} files)"
            )

    detected_mime = detect_mime_type(file_data)
    logger.info(
        "Upload detected_mime=%s content_type_header=%s filename=%s size=%d",
        detected_mime,
        content_type_header,
        original_filename,
        len(file_data),
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
            w, h = await asyncio.to_thread(get_image_dimensions, file_data)
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
    base_path = f"users/{str(user['_id'])}/{uuid.uuid4().hex}"
    diary_oid = ObjectId(diary_id) if diary_id and ObjectId.is_valid(diary_id) else None

    if category == "image":
        variants = await asyncio.to_thread(process_image, file_data)
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
            "filename": safe_filename,
            "stored_path": stored_path,
            "standard_path": standard_path,
            "thumbnail_path": thumb_path,
            "mime_type": "image/webp",
            "original_mime_type": original_mime,
            "size_bytes": size_bytes,
            "width": width,
            "height": height,
            "is_private": effective_is_private,
            "created_at": now,
        }
    else:
        ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
        stored_path = f"{base_path}.{ext}"
        await _upload_object_async(stored_path, file_data, detected_mime)

        media_doc = {
            "user_id": user["_id"],
            "diary_id": diary_oid,
            "filename": safe_filename,
            "stored_path": stored_path,
            "mime_type": detected_mime,
            "size_bytes": len(file_data),
            "width": width,
            "height": height,
            "is_private": effective_is_private,
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

    return _build_media_response(result, include_signed_url=effective_is_private)


async def delete_media(media_id: str, current_user: dict) -> None:
    repo = MediaRepository()
    media = await repo.get_by_id(media_id)
    if media is None:
        raise NotFoundException("Media not found")

    is_owner = str(media["user_id"]) == str(current_user["_id"])
    is_admin = current_user.get("is_admin", False)
    if not is_owner and not is_admin:
        raise PermissionDeniedException("You do not own this media")

    failed_paths: list[str] = []
    for path_key in ("stored_path", "standard_path", "thumbnail_path"):
        path_val = media.get(path_key)
        if path_val:
            ok = await _delete_object_async(path_val)
            if not ok:
                failed_paths.append(path_val)

    if failed_paths:
        logger.error(
            "Failed to delete MinIO objects for media %s: %s",
            media_id,
            failed_paths,
        )
    else:
        logger.info("Deleted all MinIO objects for media %s", media_id)

    await repo.delete(media_id)


async def get_media_gallery(
    user_id: str,
    page: int = 1,
    per_page: int = 20,
    diary_id: str | None = None,
) -> dict:
    repo = MediaRepository()
    skip = (page - 1) * per_page
    media_list = await repo.find_by_user(user_id, diary_id=diary_id, skip=skip, limit=per_page)
    total = await repo.count_by_user(user_id, diary_id=diary_id)

    data = []
    for m in media_list:
        effective_is_private = bool(m.get("is_private", True))
        if m.get("diary_id"):
            diary = await DiaryRepository().get_by_id(str(m["diary_id"]))
            effective_is_private = diary is None or diary.get("privacy") != "public"
        data.append(_build_media_response(m, effective_is_private=effective_is_private))

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


async def get_media_detail(media_id: str, current_user: dict) -> dict:
    repo = MediaRepository()
    media = await repo.get_by_id(media_id)
    if media is None:
        raise NotFoundException("Media not found")

    is_owner = str(media["user_id"]) == str(current_user["_id"])
    is_admin = current_user.get("is_admin", False)
    if not is_owner and not is_admin:
        raise NotFoundException("Media not found")

    effective_is_private = bool(media.get("is_private", True))
    if media.get("diary_id"):
        diary = await DiaryRepository().get_by_id(str(media["diary_id"]))
        effective_is_private = diary is None or diary.get("privacy") != "public"
    return _build_media_response(media, effective_is_private=effective_is_private)


async def get_media_signed_url(media_id: str, current_user: dict) -> dict:
    repo = MediaRepository()
    media = await repo.get_by_id(media_id)
    if media is None:
        raise NotFoundException("Media not found")

    is_owner = str(media["user_id"]) == str(current_user["_id"])
    if not is_owner:
        raise PermissionDeniedException("You do not own this media")

    diary = None
    if media.get("diary_id"):
        diary = await DiaryRepository().get_by_id(str(media["diary_id"]))
    effective_is_private = bool(media.get("is_private", True))
    if media.get("diary_id"):
        effective_is_private = diary is None or diary.get("privacy") != "public"

    url = _permanent_media_url(
        str(media["_id"]),
        media["stored_path"],
        "original",
        allow_public_base=not effective_is_private,
    )
    result = {
        "url": url,
        "id": str(media["_id"]),
        "mime_type": media["mime_type"],
        "expires_in_seconds": 0,
        "is_private": effective_is_private,
    }
    if media.get("thumbnail_path"):
        result["thumbnail_url"] = _permanent_media_url(
            str(media["_id"]),
            media["thumbnail_path"],
            "thumb",
            allow_public_base=not effective_is_private,
        )
    if media.get("standard_path"):
        result["standard_url"] = _permanent_media_url(
            str(media["_id"]),
            media["standard_path"],
            "standard",
            allow_public_base=not effective_is_private,
        )
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


async def sync_diary_media_privacy(diary_id: str, diary_privacy: str) -> int:
    """Persist the current diary privacy on every associated media record."""
    return await MediaRepository().sync_diary_privacy(
        diary_id, is_private=diary_privacy != "public"
    )
