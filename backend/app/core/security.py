import hashlib
import secrets
import time
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext
from redis.asyncio import Redis

from app.core.config import settings
from app.core.database import DatabaseManager

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, username: str, is_admin: bool = False) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "username": username,
        "is_admin": is_admin,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "iat": now,
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return payload
    except JWTError:
        from app.core.exceptions import AuthenticationException
        raise AuthenticationException("Invalid or expired access token")


def generate_refresh_token() -> str:
    return secrets.token_hex(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_email_verification_token(email: str) -> str:
    return secrets.token_urlsafe(32)


async def check_rate_limit(
    key: str, max_attempts: int, window_seconds: int
) -> tuple[bool, int]:
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        return False, max_attempts
    now = int(time.time())
    window_start = now - window_seconds
    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zcard(key)
    pipe.zadd(key, {str(now): now})
    pipe.expire(key, window_seconds)
    _, count, _, _ = await pipe.execute()
    remaining = max(0, max_attempts - count)
    if count > max_attempts:
        return True, remaining
    return False, remaining
