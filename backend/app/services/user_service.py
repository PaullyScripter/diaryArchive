import re
from datetime import UTC, datetime

from app.core.exceptions import ConflictException, PermissionDeniedException, ValidationException
from app.core.media_validator import detect_mime_type, mime_category
from app.core.utils import fmt_dt
from app.repositories.diary_repo import DiaryRepository
from app.repositories.media_repo import MediaRepository
from app.repositories.user_repo import UserRepository
from app.services.encryption_service import (
    encrypt_email,
    hash_email,
    legacy_email_hash,
)
from app.services.media_service import delete_media, upload_media

AVATAR_DIARY_THRESHOLD = 50
_MEDIA_FILE_RE = re.compile(r"/media/file/([a-f0-9]{24})(?:\?|$)", re.IGNORECASE)


def build_public_profile(user: dict, is_following: bool = False) -> dict:
    badges_dict = user.get("displayed_badges") or {}
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "avatar_path": user.get("avatar_path"),
        "about": user.get("about"),
        "favorite_quote": user.get("favorite_quote"),
        "currently_feeling": user.get("currently_feeling"),
        "stats": user.get(
            "stats",
            {
                "diary_count": 0,
                "follower_count": 0,
                "following_count": 0,
            },
        ),
        "created_at": fmt_dt(user.get("created_at")),
        "is_following": is_following,
        "is_admin": bool(user.get("is_admin")),
        "badges": list(badges_dict.values()) if badges_dict else [],
    }


async def get_user_profile(username: str, current_user: dict | None = None) -> dict:
    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)

    if user is None:
        from app.core.exceptions import NotFoundException

        raise NotFoundException("User not found")

    if user.get("is_banned"):
        from app.core.exceptions import NotFoundException

        raise NotFoundException("User not found")

    is_following = False
    if current_user and str(current_user["_id"]) != str(user["_id"]):
        try:
            from app.repositories.follow_repo import FollowRepository

            follow_repo = FollowRepository()
            existing = await follow_repo.find_one(
                {
                    "follower_id": current_user["_id"],
                    "following_id": user["_id"],
                }
            )
            is_following = existing is not None
        except ImportError:
            pass

    return build_public_profile(user, is_following)


async def update_user_profile(user_id: str, update_data: dict) -> dict:
    user_repo = UserRepository()
    existing_user = await user_repo.get_by_id(user_id)
    if existing_user is None:
        raise ValidationException("User not found")

    bio_deadline = existing_user.get("bio_edit_banned_until")
    if "about" in update_data and bio_deadline:
        if bio_deadline.tzinfo is None:
            bio_deadline = bio_deadline.replace(tzinfo=UTC)
        if bio_deadline > datetime.now(UTC):
            raise PermissionDeniedException("Bio editing is temporarily suspended")

    set_fields = {}
    for field in ("about", "favorite_quote", "currently_feeling"):
        if field in update_data and update_data[field] is not None:
            set_fields[field] = update_data[field]
        elif field in update_data:
            set_fields[field] = None

    if "preferences" in update_data and update_data["preferences"] is not None:
        existing_prefs = existing_user.get("preferences", {})
        incoming = update_data["preferences"]
        if isinstance(incoming, dict):
            merged = {**existing_prefs, **incoming}
        else:
            merged = incoming.model_dump() if hasattr(incoming, "model_dump") else incoming
            merged = {**existing_prefs, **merged}
        valid_themes = {"light", "dark", "system"}
        if merged.get("theme") not in valid_themes:
            raise ValidationException(f"Theme must be one of: {', '.join(valid_themes)}")
        set_fields["preferences"] = merged

    set_fields["updated_at"] = datetime.now(UTC)

    await user_repo.update(user_id, set_fields)
    user = await user_repo.get_by_id(user_id)
    return build_public_profile(user)


async def update_username(user_id: str, username: str) -> dict:
    user_repo = UserRepository()
    username = username.lower().strip()
    existing = await user_repo.get_by_username(username)
    if existing and str(existing["_id"]) != user_id:
        raise ConflictException("Username is already taken")
    try:
        updated = await user_repo._collection.update_one(
            {"_id": user_repo._to_object_id(user_id)},
            {
                "$set": {
                    "username": username,
                    "username_warning_deadline": None,
                    "username_warning_reason": None,
                    "updated_at": datetime.now(UTC),
                }
            },
        )
    except Exception as exc:
        from pymongo.errors import DuplicateKeyError

        if isinstance(exc, DuplicateKeyError):
            raise ConflictException("Username is already taken") from exc
        raise
    if updated.matched_count != 1:
        raise ValidationException("User not found")
    user = await user_repo.get_by_id(user_id)
    return build_public_profile(user)


async def upload_user_avatar(
    user: dict,
    file_data: bytes,
    original_filename: str,
    content_type_header: str | None = None,
) -> dict:
    """Upload and publish a user's profile picture after the diary milestone."""
    user_id = str(user["_id"])
    diary_count = await DiaryRepository().count_user_diaries(user_id)
    if diary_count < AVATAR_DIARY_THRESHOLD:
        remaining = AVATAR_DIARY_THRESHOLD - diary_count
        raise PermissionDeniedException(
            f"Profile picture uploads unlock after {AVATAR_DIARY_THRESHOLD} diaries "
            f"({remaining} more to go)"
        )

    detected_mime = detect_mime_type(file_data)
    if detected_mime is None or mime_category(detected_mime) != "image":
        raise ValidationException("Profile pictures must be image files")

    previous_avatar = user.get("avatar_path")
    uploaded = await upload_media(
        user=user,
        file_data=file_data,
        original_filename=original_filename,
        content_type_header=content_type_header,
        is_private=False,
    )

    media_repo = MediaRepository()
    media_id = uploaded["id"]
    media = await media_repo.get_by_id(media_id)
    if media is None:
        raise ValidationException("Profile picture upload could not be finalized")

    # Unattached uploads are private by default for diary safety. Avatars are
    # intentionally public because they appear on public profiles.
    await media_repo.update(media_id, {"is_private": False})
    avatar_url = f"/api/v1/media/file/{media_id}?v=thumb"

    try:
        await UserRepository().update(
            user_id,
            {"avatar_path": avatar_url, "updated_at": datetime.now(UTC)},
        )
    except Exception:
        await delete_media(media_id, user)
        raise

    if previous_avatar and previous_avatar != avatar_url:
        old_media_id = _MEDIA_FILE_RE.search(str(previous_avatar))
        if old_media_id:
            old_media = await media_repo.get_by_id(old_media_id.group(1))
        else:
            old_media = await media_repo.find_one(
                {"user_id": user["_id"], "stored_path": previous_avatar}
            )
        if old_media and str(old_media.get("_id")) != media_id:
            try:
                await delete_media(str(old_media["_id"]), user)
            except Exception:
                # A replacement should succeed even if cleanup of a legacy
                # avatar object needs to be handled by maintenance later.
                pass

    return {"avatar_path": avatar_url}


async def update_user_email(user_id: str, email: str | None) -> dict:
    user_repo = UserRepository()

    if email is not None and not email.strip():
        email = None

    if email is not None:
        email = email.strip()
        if "@" not in email or len(email) > 254:
            from app.core.exceptions import ValidationException

            raise ValidationException("Invalid email format")

        encrypted = encrypt_email(email)
        hashed = hash_email(email)

        existing = await user_repo.get_by_email_hashes([hashed, legacy_email_hash(email)])
        if existing and str(existing["_id"]) != user_id:
            raise ConflictException("Email is already associated with another account")

        await user_repo.update(
            user_id,
            {
                "email_encrypted": encrypted,
                "email_hash": hashed,
                "email_verified": False,
                "updated_at": datetime.now(UTC),
            },
        )

        return {
            "has_email": True,
            "email_verified": False,
            "message": "Email updated. A verification email has been sent to your new address.",
        }
    else:
        await user_repo.update(
            user_id,
            {
                "email_encrypted": None,
                "email_hash": None,
                "email_verified": False,
                "updated_at": datetime.now(UTC),
            },
        )

        return {
            "has_email": False,
            "email_verified": False,
            "message": "Email removed.",
        }


async def update_encryption_key(
    user_id: str, encrypted_master_key: str, master_key_salt: str, master_key_iv: str
) -> dict:
    user_repo = UserRepository()
    await user_repo.update(
        user_id,
        {
            "encrypted_master_key": encrypted_master_key,
            "master_key_salt": master_key_salt,
            "master_key_iv": master_key_iv,
            "updated_at": datetime.now(UTC),
        },
    )
    return {
        "has_master_key": True,
        "message": "Encryption key stored successfully.",
    }
