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


def create_access_token(user_id: str, username: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "username": username,
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


async def validate_access_token(token: str) -> dict:
    """Decode and validate a token, including revocation check."""
    from app.core.exceptions import AuthenticationException
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    iat = payload.get("iat")
    if user_id and iat:
        if await _is_token_invalidated(user_id, iat):
            raise AuthenticationException("Token has been revoked")
    return payload


def generate_refresh_token() -> str:
    return secrets.token_hex(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_email_verification_token(email: str) -> str:
    return secrets.token_urlsafe(32)


_fallback_lock = threading.Lock()
_fallback_hits: dict[str, deque[int]] = defaultdict(deque)


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
        hits.append(now_ms)
        # Prune the entry only once all its hits have fallen outside the window
        # (avoids unbounded growth). An empty-but-present deque is harmless.
        if not hits:
            del _fallback_hits[key]
        return False, max(0, max_attempts - len(hits))


def _fallback_count(key: str, window_seconds: int) -> int:
    """Return how many hits remain within the window for a key in the fallback
    limiter. Used by is_locked_out/clear_attempts so they agree with
    record_failed_attempt when Redis is unavailable."""
    now_ms = int(time.time() * 1000)
    window_start = now_ms - (window_seconds * 1000)
    with _fallback_lock:
        hits = _fallback_hits.get(key)
        if not hits:
            return 0
        while hits and hits[0] < window_start:
            hits.popleft()
        return len(hits)


def get_client_ip(request) -> str:
    """Return a client IP that is safe to use for security decisions (rate limits).

    The proxy (nginx) is configured to overwrite X-Real-IP with the real
    remote address, so it is authoritative. X-Forwarded-For is attacker
    controllable, so never trust its leftmost entry; when used as a fallback
    only the rightmost (proxy-appended) value is taken.
    """
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    client = getattr(request, "client", None)
    if client is not None and client.host:
        return client.host
    return "unknown"


async def record_failed_attempt(key: str, max_attempts: int, window_seconds: int) -> bool:
    """Increment a failure counter; returns True once the account is locked out."""
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        limited, _ = _fallback_consume(f"lockout:{key}", max_attempts, window_seconds)
        return limited
    try:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = await pipe.execute()
        return count >= max_attempts
    except Exception:
        return False


async def is_locked_out(key: str, max_attempts: int, window_seconds: int = 300) -> bool:
    """Check (without consuming) whether a failure counter has reached the limit."""
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        # Agree with record_failed_attempt's fallback namespacing.
        return _fallback_count(f"lockout:{key}", window_seconds) >= max_attempts
    try:
        count = await redis.get(key)
        return count is not None and int(count) >= max_attempts
    except Exception:
        return False


async def clear_attempts(key: str) -> None:
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        with _fallback_lock:
            _fallback_hits.pop(f"lockout:{key}", None)
        return
    try:
        await redis.delete(key)
    except Exception:
        pass


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


# ---------------------------------------------------------------------------
# Token invalidation (P2.1)
# ---------------------------------------------------------------------------
# Strategy: user-level invalidation timestamp stored in Redis.
# All tokens issued before the timestamp are rejected.
# More scalable than per-JTI blocklisting and covers all scenarios:
#   - password change / reset
#   - logout / logout-all
#   - admin security action
#   - account compromise

_TOKEN_INVALIDATION_PREFIX = "auth:invalid_before:"


async def invalidate_all_user_tokens(user_id: str) -> None:
    """Set a timestamp that invalidates all access tokens for this user."""
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        logger.warning("Redis unavailable; cannot invalidate tokens for user %s", user_id)
        return
    try:
        key = f"{_TOKEN_INVALIDATION_PREFIX}{user_id}"
        # Expire the invalidation entry after 2x the max token lifetime
        # (tokens can't live longer than access_token_expire_minutes anyway).
        max_ttl = settings.access_token_expire_minutes * 2 * 60
        await redis.set(key, int(time.time()), ex=max_ttl)
    except Exception:
        logger.exception("Failed to invalidate tokens for user %s", user_id)


async def _is_token_invalidated(user_id: str, token_iat: datetime) -> bool:
    """Check whether a token was issued before the user's invalidation timestamp."""
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        # Redis down: fail-open for availability (token is short-lived anyway).
        return False
    try:
        key = f"{_TOKEN_INVALIDATION_PREFIX}{user_id}"
        invalid_before = await redis.get(key)
        if invalid_before is None:
            return False
        invalid_ts = datetime.fromtimestamp(int(invalid_before), tz=UTC)
        return token_iat < invalid_ts
    except Exception:
        return False
