import asyncio
import hashlib
import ipaddress
import logging
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from bson import ObjectId
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
        try:
            invalidated = await _is_token_invalidated(user_id, iat)
        except Exception as exc:
            # Revocation state is security-critical. A database outage must
            # not turn token validation into a fail-open path.
            logger.error("Token revocation lookup failed: %s", exc)
            raise AuthenticationException("Token revocation state unavailable") from exc
        if invalidated:
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
_MAX_FALLBACK_KEYS = 100000


def _fallback_consume(key: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
    """In-process fail-closed limiter used when Redis is unreachable."""
    now_ms = int(time.time() * 1000)
    window_start = now_ms - (window_seconds * 1000)
    with _fallback_lock:
        # Evict oldest keys if at capacity
        if len(_fallback_hits) >= _MAX_FALLBACK_KEYS:
            sorted_keys = sorted(
                _fallback_hits.keys(),
                key=lambda k: _fallback_hits[k][0] if _fallback_hits[k] else 0,
            )
            for k in sorted_keys[:10000]:
                del _fallback_hits[k]
        hits = _fallback_hits[key]
        while hits and hits[0] < window_start:
            hits.popleft()
        if len(hits) >= max_attempts:
            return True, 0
        hits.append(now_ms)
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


def _is_trusted_proxy(ip: str) -> bool:
    """Check if an IP is in the explicitly configured proxy allowlist."""
    if ip == "unknown":
        return False
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for cidr in settings.trusted_proxy_cidrs:
        try:
            if address in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            logger.error("Invalid trusted proxy CIDR configured: %s", cidr)
    return False


def get_client_ip(request) -> str:
    """Return a client IP that is safe to use for security decisions (rate limits).

    Only trusts X-Real-IP/X-Forwarded-For when the direct client is a trusted
    proxy (e.g. nginx on the same host). Prevents rate limit bypass when the
    backend is directly exposed.
    """
    client_host = getattr(request, "client", None)
    direct_ip = client_host.host if client_host else "unknown"

    # If the direct connection is not from a trusted proxy, ignore proxy headers
    if not _is_trusted_proxy(direct_ip):
        return direct_ip

    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return direct_ip


async def record_failed_attempt(key: str, max_attempts: int, window_seconds: int) -> bool:
    """Increment a failure counter; returns True once the account is locked out."""
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        limited, _ = _fallback_consume(f"lockout:{key}", max_attempts, window_seconds)
        return limited
    try:
        count = await redis.eval(
            """
            local count = redis.call('INCR', KEYS[1])
            redis.call('EXPIRE', KEYS[1], ARGV[1])
            return count
            """,
            1,
            key,
            window_seconds,
        )
        return int(count) >= max_attempts
    except Exception as exc:
        # Authentication lockouts are security-critical. A Redis outage must
        # not silently turn the account lockout into a brute-force bypass.
        logger.error("Lockout counter unavailable; failing closed: %s", exc)
        return True


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
    except Exception as exc:
        logger.error("Lockout state unavailable; failing closed: %s", exc)
        return True


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


async def check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        logger.warning("Redis unavailable; falling back to in-process rate limiting for %s", key)
        return _fallback_consume(key, max_attempts, window_seconds)
    try:
        now = int(time.time() * 1000)
        window_start = now - (window_seconds * 1000)
        member = f"{now}:{secrets.token_hex(4)}"
        limited, remaining = await redis.eval(
            """
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
            local count = redis.call('ZCARD', KEYS[1])
            if count >= tonumber(ARGV[3]) then
                redis.call('EXPIRE', KEYS[1], ARGV[4])
                return {1, 0}
            end
            redis.call('ZADD', KEYS[1], ARGV[2], ARGV[5])
            redis.call('EXPIRE', KEYS[1], ARGV[4])
            return {0, tonumber(ARGV[3]) - count - 1}
            """,
            1,
            key,
            window_start,
            now,
            max_attempts,
            window_seconds,
            member,
        )
        return bool(limited), int(remaining)
    except Exception:  # Redis down: fail closed.
        logger.error("Redis rate limiter unavailable; failing closed for %s", key)
        return True, 0


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
    """Persist a durable timestamp that invalidates all access tokens."""
    invalidated_at = int(time.time())
    db = DatabaseManager.get_db()
    if not ObjectId.is_valid(user_id):
        raise ValueError("Invalid user id")
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"tokens_invalid_before": invalidated_at}},
    )
    if result.matched_count != 1:
        raise RuntimeError(f"Cannot invalidate tokens for unknown user {user_id}")

    # Redis is an optimization for deployments that need to avoid the Mongo
    # read. The database field above remains the authoritative fallback.
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        logger.warning("Redis unavailable; durable token invalidation stored in MongoDB")
        return
    try:
        key = f"{_TOKEN_INVALIDATION_PREFIX}{user_id}"
        max_ttl = settings.access_token_expire_minutes * 2 * 60
        await redis.set(key, invalidated_at, ex=max_ttl)
    except Exception:
        logger.warning("Redis token invalidation cache write failed; MongoDB remains authoritative")


async def _is_token_invalidated(user_id: str, token_iat: datetime | int | float) -> bool:
    """Check whether a token was issued before the user's invalidation timestamp."""
    if not ObjectId.is_valid(user_id):
        return True

    key = f"{_TOKEN_INVALIDATION_PREFIX}{user_id}"
    invalid_before = None
    cache_available = False
    try:
        redis: Redis = DatabaseManager.get_redis()
        cached = await redis.get(key)
        cache_available = True
        if cached is not None:
            invalid_before = float(cached)
    except Exception:
        # MongoDB remains authoritative when Redis is unavailable.
        logger.warning("Token invalidation cache lookup failed; using MongoDB")

    if not cache_available or invalid_before is None:
        db = DatabaseManager.get_db()
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"tokens_invalid_before": 1})
        if user is None:
            return True
        invalid_before = user.get("tokens_invalid_before")
        if invalid_before is None:
            # Cache a short-lived negative result to avoid a MongoDB read on
            # every authenticated request while preserving prompt revocation.
            if cache_available:
                try:
                    await redis.set(key, "0", ex=settings.access_token_expire_minutes * 60)
                except Exception:
                    pass
            return False
        if cache_available:
            try:
                await redis.set(
                    key,
                    int(invalid_before),
                    ex=settings.access_token_expire_minutes * 2 * 60,
                )
            except Exception:
                pass

    issued_at = token_iat.timestamp() if isinstance(token_iat, datetime) else float(token_iat)
    # JWT iat has second precision. Reject the same-second token too, or a
    # token created immediately before invalidation can survive the cutoff.
    return float(invalid_before) > 0 and issued_at <= float(invalid_before)
