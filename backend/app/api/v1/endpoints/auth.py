import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.utils import fmt_dt
from app.core.exceptions import (
    AuthenticationException,
    ConflictException,
    PermissionDeniedException,
    RateLimitException,
    ValidationException,
)
from app.core.security import (
    check_rate_limit,
    create_access_token,
    create_email_verification_token,
    generate_refresh_token,
    hash_password_async,
    hash_token,
    verify_password_async,
)
from app.models.token import AuthResponse, RegisterResponse, TokenResponse
from app.models.user import UserCreate, UserLogin
from app.repositories.password_reset_token_repo import PasswordResetTokenRepository
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.user_repo import UserRepository
from app.services.encryption_service import encrypt_email, hash_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_user_response(user: dict) -> dict:
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
        "is_admin": user.get("is_admin", False),
        "has_email": bool(user.get("email_encrypted")),
        "email_verified": user.get("email_verified", False),
        "has_master_key": bool(user.get("encrypted_master_key")),
        "preferences": user.get("preferences", {
            "theme": "system",
            "comments_disabled": False,
            "email_notifications": False,
            "notify_on_like": True,
            "notify_on_comment": True,
            "notify_on_follow": True,
            "notify_on_bookmark": False,
        }),
        "created_at": fmt_dt(user.get("created_at")),
        "last_login_at": fmt_dt(user.get("last_login_at")),
    }


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=not settings.debug,
        samesite="strict" if not settings.debug else "lax",
        path="/api/v1/auth",
        max_age=604800,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
    )


def _validate_password(password: str) -> None:
    if len(password) < 8 or len(password) > 128:
        raise ValidationException("Password must be between 8 and 128 characters")
    if not any(c.isalpha() for c in password):
        raise ValidationException("Password must contain at least one letter")
    if not any(c.isdigit() for c in password):
        raise ValidationException("Password must contain at least one digit")


async def _generate_tokens(response: Response, user_id: str) -> str:
    refresh_token_raw = generate_refresh_token()
    refresh_token_hash = hash_token(refresh_token_raw)
    refresh_repo = RefreshTokenRepository()
    await refresh_repo.create_token(user_id, refresh_token_hash)
    _set_refresh_cookie(response, refresh_token_raw)
    return refresh_token_raw


@router.post("/register", status_code=201)
async def register(
    body: UserCreate,
    request: Request,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:register:{request.client.host}", 5, 60
    )
    if is_limited:
        raise RateLimitException("Too many registration attempts")

    _validate_password(body.password)

    if body.email and not body.email.strip():
        body.email = None

    user_repo = UserRepository()

    existing = await user_repo.get_by_username(body.username)
    if existing:
        raise ConflictException("Username is already taken")

    email_encrypted = None
    email_hash = None
    if body.email:
        try:
            email_encrypted = encrypt_email(body.email)
            email_hash = hash_email(body.email)
            existing_email = await user_repo.get_by_email_hash(email_hash)
            if existing_email:
                raise ConflictException("Email is already associated with another account")
        except ConflictException:
            raise
        except Exception:
            raise ValidationException("Invalid email format")

    password_hash = await hash_password_async(body.password)

    user_doc = {
        "username": body.username.lower(),
        "password_hash": password_hash,
        "email_verified": False,
        "avatar_path": None,
        "about": None,
        "favorite_quote": None,
        "currently_feeling": None,
        "is_admin": False,
        "is_banned": False,
        "preferences": {
            "theme": "system",
            "comments_disabled": False,
            "email_notifications": False,
            "notify_on_like": True,
            "notify_on_comment": True,
            "notify_on_follow": True,
            "notify_on_bookmark": False,
        },
        "stats": {"diary_count": 0, "follower_count": 0, "following_count": 0},
        "created_at": datetime.now(UTC),
        "last_login_at": None,
    }
    if email_encrypted:
        user_doc["email_encrypted"] = email_encrypted
    if email_hash:
        user_doc["email_hash"] = email_hash

    user_id = await user_repo.create_user(user_doc)

    access_token = create_access_token(user_id, body.username.lower())

    await _generate_tokens(response, user_id)

    return {"data": RegisterResponse(
        id=user_id,
        username=body.username.lower(),
        created_at=user_doc["created_at"].isoformat(),
        access_token=access_token,
    )}


@router.post("/login")
async def login(
    body: UserLogin,
    request: Request,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:login:{request.client.host}", 10, 60
    )
    if is_limited:
        raise RateLimitException("Too many login attempts")

    user_repo = UserRepository()
    user = await user_repo.get_by_username(body.username.lower())

    if user is None or not await verify_password_async(body.password, user["password_hash"]):
        raise AuthenticationException("Invalid username or password")

    if user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    await user_repo.update(str(user["_id"]), {"last_login_at": datetime.now(UTC)})

    access_token = create_access_token(
        str(user["_id"]), user["username"], user.get("is_admin", False)
    )

    await _generate_tokens(response, str(user["_id"]))

    return {"data": AuthResponse(
        id=str(user["_id"]),
        username=user["username"],
        is_admin=user.get("is_admin", False),
        access_token=access_token,
    )}


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:refresh:{request.client.host}", 20, 60
    )
    if is_limited:
        raise RateLimitException("Too many refresh attempts")

    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise AuthenticationException("No refresh token provided")

    token_hash = hash_token(refresh_token)
    refresh_repo = RefreshTokenRepository()
    stored = await refresh_repo.find_one_and_delete(token_hash)

    if stored is None:
        raise AuthenticationException("Invalid refresh token")

    if stored["expires_at"].replace(tzinfo=UTC) < datetime.now(UTC):
        raise AuthenticationException("Refresh token has expired")

    user_repo = UserRepository()
    user = await user_repo.get_by_id(stored["user_id"])
    if user is None:
        await refresh_repo.delete_by_hash(token_hash)
        raise AuthenticationException("User not found")

    if user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    access_token = create_access_token(
        str(user["_id"]), user["username"], user.get("is_admin", False)
    )
    await _generate_tokens(response, str(user["_id"]))

    return {"data": TokenResponse(access_token=access_token)}


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        token_hash = hash_token(refresh_token)
        refresh_repo = RefreshTokenRepository()
        await refresh_repo.delete_by_hash(token_hash)

    _clear_refresh_cookie(response)
    return Response(status_code=204)


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
):
    return {"data": _build_user_response(current_user)}


@router.put("/change-password")
async def change_password(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    current_password = body.get("current_password")
    new_password = body.get("new_password")

    if not current_password or not new_password:
        raise ValidationException("Both current_password and new_password are required")

    if not await verify_password_async(current_password, current_user["password_hash"]):
        raise AuthenticationException("Current password is incorrect")

    _validate_password(new_password)

    user_repo = UserRepository()
    update_fields = {"password_hash": await hash_password_async(new_password)}

    if "new_encrypted_master_key" in body and "new_master_key_salt" in body:
        if body.get("new_encrypted_master_key") and body.get("new_master_key_salt"):
            update_fields["encrypted_master_key"] = body["new_encrypted_master_key"]
            update_fields["master_key_salt"] = body["new_master_key_salt"]
            if "new_master_key_iv" in body:
                update_fields["master_key_iv"] = body["new_master_key_iv"]
        elif current_user.get("encrypted_master_key"):
            update_fields["encrypted_master_key"] = None
            update_fields["master_key_salt"] = None
            update_fields["master_key_iv"] = None

    await user_repo.update(str(current_user["_id"]), update_fields)

    refresh_repo = RefreshTokenRepository()
    revoked = await refresh_repo.delete_all_for_user(str(current_user["_id"]))
    logger.info(
        "Changed password for user %s, revoked %d sessions",
        current_user["username"],
        revoked,
    )

    msg = "Password changed successfully. All other sessions have been logged out."
    return {"data": {"message": msg}}


@router.post("/request-password-reset")
async def request_password_reset(
    body: dict,
    request: Request,
):
    username = body.get("username", "").lower().strip()
    if not username:
        raise ValidationException("Username is required")

    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)

    if user and user.get("email_encrypted"):
        is_limited, _ = await check_rate_limit(
            f"rate_limit:password_reset:{user['email_hash']}", 3, 3600
        )
        if is_limited:
            raise RateLimitException("Too many password reset requests")

        reset_token_raw = create_email_verification_token("")
        reset_token_hash = hash_token(reset_token_raw)
        reset_repo = PasswordResetTokenRepository()
        await reset_repo.create_token(str(user["_id"]), reset_token_hash)

        logger.info(
            "Password reset requested for %s (token hash: %s)",
            username,
            reset_token_hash[:8],
        )

    return {
        "data": {"message": "If this account has an email, a reset link has been sent."}
    }


@router.post("/reset-password")
async def reset_password(
    body: dict,
    request: Request,
):
    token = body.get("token", "")
    new_password = body.get("new_password", "")

    if not token or not new_password:
        raise ValidationException("Token and new_password are required")

    _validate_password(new_password)

    token_hash = hash_token(token)
    reset_repo = PasswordResetTokenRepository()
    stored = await reset_repo.find_by_hash(token_hash)

    if stored is None:
        raise AuthenticationException("Invalid or expired reset token")

    if stored["expires_at"].replace(tzinfo=UTC) < datetime.now(UTC):
        raise AuthenticationException("Reset token has expired")

    user_repo = UserRepository()
    user = await user_repo.get_by_id(stored["user_id"])
    if user is None:
        raise AuthenticationException("User not found")

    new_hash = await hash_password_async(new_password)
    await user_repo.update(str(user["_id"]), {
        "password_hash": new_hash,
        "encrypted_master_key": None,
        "master_key_salt": None,
        "master_key_iv": None,
    })

    await reset_repo.mark_used(token_hash)

    refresh_repo = RefreshTokenRepository()
    await refresh_repo.delete_all_for_user(str(user["_id"]))

    return {
        "data": {"message": "Password reset successfully. Please log in with your new password."}
    }
