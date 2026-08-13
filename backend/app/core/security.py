import asyncio
import hashlib
import logging
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import Request
from jose import JWTError, jwt
from passlib.context import CryptContext
from redis.asyncio import Redis

from app.core.config import settings
from app.core.database import DatabaseManager

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


async def hash_password_async(password: str) -> str:
    return await asyncio.to_thread(hash_password, password)


async def verify_password_async(plain: str, hashed: str) -> bool:
    return await asyncio.to_thread(verify_password, plain, hashed)


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


_fallback_lock = threading.Lock()
_fallback_hits: dict[str, deque[int]] = defaultdict(deque)

_FALLBACK_INTERVAL_MS = 2500


def _fallback_consume(key: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
    """In-process fail-closed limiter used when Redis is unreachable."""
    now_ms = int(time.time() * 1000)
    window_start = now_ms - (window_seconds * 1000)
    with _fallback_lock:
        hits = _fallback_hits[key]
        while hits and hits[0] < window_start:
            hits.popleft()
        if len(hits) >= max_attempts:
            return True, 0
        top = hits[-1] if hits else 0
        hits.append(now_ms)
        # Prune empty keys to avoid unbounded growth.
        if hits and now_ms - top > _FALLBACK_INTERVAL_MS:
            del _fallback_hits[key]
        return False, max(0, max_attempts - len(hits))


def get_client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = getattr(request, "client", None)
    if client is not None and client.host:
        return client.host
    return "unknown"


async def check_rate_limit(
    key: str, max_attempts: int, window_seconds: int
) -> tuple[bool, int]:
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        logger.warning("Redis unavailable; falling back to in-process rate limiting for %s", key)
        return _fallback_consume(key, max_attempts, window_seconds)
    try:
        now = int(time.time() * 1000)
        window_start = now - (window_seconds * 1000)
        member = f"{now}:{secrets.token_hex(4)}"
        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {member: now})
        pipe.expire(key, window_seconds)
        _, count, _, _ = await pipe.execute()
    except Exception:  # Redis down: fail closed.
        logger.warning("Redis error; falling back to in-process rate limiting for %s", key)
        return _fallback_consume(key, max_attempts, window_seconds)
    remaining = max(0, max_attempts - count)
    if count > max_attempts:
        return True, remaining
    return False, remaining
