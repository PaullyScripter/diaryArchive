from datetime import UTC, datetime

from app.core.exceptions import ConflictException, PermissionDeniedException
from app.core.security import hash_token
from app.core.utils import fmt_dt
from app.repositories.user_repo import UserRepository
from app.services.encryption_service import encrypt_email, hash_email


def build_public_profile(user: dict, is_following: bool = False) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "avatar_path": user.get("avatar_path"),
        "about": user.get("about"),
        "favorite_quote": user.get("favorite_quote"),
        "currently_feeling": user.get("currently_feeling"),
        "stats": user.get("stats", {
            "diary_count": 0,
            "follower_count": 0,
            "following_count": 0,
        }),
        "created_at": fmt_dt(user.get("created_at")),
        "is_following": is_following,
    }


async def get_user_profile(username: str, current_user: dict | None = None) -> dict:
    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)

    if user is None:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("User not found")

    if user.get("is_banned"):
        raise PermissionDeniedException("This account has been suspended")

    is_following = False
    if current_user and str(current_user["_id"]) != str(user["_id"]):
        try:
            from app.repositories.follow_repo import FollowRepository
            follow_repo = FollowRepository()
            existing = await follow_repo.find_one({
                "follower_id": current_user["_id"],
                "following_id": user["_id"],
            })
            is_following = existing is not None
        except ImportError:
            pass

    return build_public_profile(user, is_following)


async def update_user_profile(user_id: str, update_data: dict) -> dict:
    user_repo = UserRepository()

    set_fields = {}
    for field in ("avatar_path", "about", "favorite_quote", "currently_feeling"):
        if field in update_data and update_data[field] is not None:
            set_fields[field] = update_data[field]
        elif field in update_data:
            set_fields[field] = None

    if "preferences" in update_data and update_data["preferences"] is not None:
        prefs = update_data["preferences"]
        valid_themes = {"light", "dark", "system"}
        if "theme" in prefs:
            if prefs["theme"] not in valid_themes:
                from app.core.exceptions import ValidationException
                raise ValidationException(
                    f"Theme must be one of: {', '.join(valid_themes)}"
                )
        set_fields["preferences"] = prefs

    set_fields["updated_at"] = datetime.now(UTC)

    await user_repo.update(user_id, set_fields)
    user = await user_repo.get_by_id(user_id)
    return build_public_profile(user)


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

        existing = await user_repo.get_by_email_hash(hashed)
        if existing and str(existing["_id"]) != user_id:
            raise ConflictException("Email is already associated with another account")

        await user_repo.update(user_id, {
            "email_encrypted": encrypted,
            "email_hash": hashed,
            "email_verified": False,
            "updated_at": datetime.now(UTC),
        })

        return {
            "has_email": True,
            "email_verified": False,
            "message": "Email updated. Verification email will be sent when SMTP is configured.",
        }
    else:
        await user_repo.update(user_id, {
            "email_encrypted": None,
            "email_hash": None,
            "email_verified": False,
            "updated_at": datetime.now(UTC),
        })

        return {
            "has_email": False,
            "email_verified": False,
            "message": "Email removed.",
        }


async def update_encryption_key(user_id: str, encrypted_master_key: str, master_key_salt: str, master_key_iv: str) -> dict:
    user_repo = UserRepository()
    await user_repo.update(user_id, {
        "encrypted_master_key": encrypted_master_key,
        "master_key_salt": master_key_salt,
        "master_key_iv": master_key_iv,
        "updated_at": datetime.now(UTC),
    })
    return {
        "has_master_key": True,
        "message": "Encryption key stored successfully.",
    }
