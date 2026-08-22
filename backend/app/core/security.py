import asyncio
import hashlib
import logging
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

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


_TRUSTED_PROXIES = {"127.0.0.1", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}


def _is_trusted_proxy(ip: str) -> bool:
    """Check if an IP is a known private/trusted proxy address."""
    if ip in ("127.0.0.1", "::1", "unknown"):
        return True
    # Check common Docker/internal ranges
    private_prefixes = (
        "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
        "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.",
        "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.",
    )
    for prefix in private_prefixes:
        if ip.startswith(prefix):
            return True
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

# In-memory fallback blocklist when Redis is unavailable.
# Stores {user_id: unix_timestamp} for users whose tokens were revoked.
_inmemory_token_blocklist: dict[str, float] = {}
_blocklist_lock = threading.Lock()
_MAX_BLOCKLIST_KEYS = 10000


async def invalidate_all_user_tokens(user_id: str) -> None:
    """Set a timestamp that invalidates all access tokens for this user."""
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        logger.warning("Redis unavailable; using in-memory blocklist for user %s", user_id)
        with _blocklist_lock:
            if len(_inmemory_token_blocklist) >= _MAX_BLOCKLIST_KEYS:
                # Evict oldest entries
                oldest = sorted(_inmemory_token_blocklist.items(), key=lambda x: x[1])[:1000]
                for k, _ in oldest:
                    del _inmemory_token_blocklist[k]
            _inmemory_token_blocklist[user_id] = time.time()
        return
    try:
        key = f"{_TOKEN_INVALIDATION_PREFIX}{user_id}"
        max_ttl = settings.access_token_expire_minutes * 2 * 60
        await redis.set(key, int(time.time()), ex=max_ttl)
    except Exception:
        logger.exception("Failed to invalidate tokens for user %s", user_id)


async def _is_token_invalidated(user_id: str, token_iat: datetime) -> bool:
    """Check whether a token was issued before the user's invalidation timestamp."""
    try:
        redis: Redis = DatabaseManager.get_redis()
    except RuntimeError:
        # Redis down: check in-memory blocklist
        with _blocklist_lock:
            inv_ts = _inmemory_token_blocklist.get(user_id)
            if inv_ts is not None:
                return token_iat < datetime.fromtimestamp(inv_ts, tz=UTC)
        return False
    try:
        key = f"{_TOKEN_INVALIDATION_PREFIX}{user_id}"
        invalid_before = await redis.get(key)
        if invalid_before is None:
            # Also check in-memory blocklist
            with _blocklist_lock:
                inv_ts = _inmemory_token_blocklist.get(user_id)
                if inv_ts is not None:
                    return token_iat < datetime.fromtimestamp(inv_ts, tz=UTC)
            return False
        invalid_ts = datetime.fromtimestamp(int(invalid_before), tz=UTC)
        return token_iat < invalid_ts
    except Exception:
        return False
