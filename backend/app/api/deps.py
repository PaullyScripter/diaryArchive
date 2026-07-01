import logging

from fastapi import Depends, Header
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import DatabaseManager
from app.core.exceptions import AuthenticationException, PermissionDeniedException
from app.core.security import decode_access_token
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


async def _optional_user(
    authorization: str = Header(None, alias="Authorization"),
) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1]
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id:
            user_repo = UserRepository()
            user = await user_repo.get_by_id(user_id)
            if user and not user.get("is_banned"):
                return user
    except AuthenticationException:
        return None
    return None


async def get_db() -> AsyncIOMotorDatabase:
    return DatabaseManager.get_db()


async def get_redis():
    return DatabaseManager.get_redis()


async def get_current_user(
    authorization: str = Header(None, alias="Authorization"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationException("Not authenticated")

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    user_id = payload.get("sub")

    repo = UserRepository()
    user = await repo.get_by_id(user_id)
    if user is None:
        raise AuthenticationException("User not found")

    if user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    return user


async def get_current_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if not current_user.get("is_admin"):
        raise PermissionDeniedException("Admin access required")
    return current_user
