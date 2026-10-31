import hashlib
import json
import logging
from collections.abc import Callable

from app.core.database import DatabaseManager

logger = logging.getLogger(__name__)

FEED_TTL = 30
PROFILE_TTL = 120
UNREAD_COUNT_TTL = 30
TAGS_TTL = 300
EMOTIONS_TTL = 300


class RedisCache:
    def _get_redis(self):
        try:
            return DatabaseManager.get_redis()
        except RuntimeError:
            return None

    async def get(self, key: str) -> str | None:
        redis = self._get_redis()
        if redis is None:
            return None
        try:
            return await redis.get(key)
        except Exception:
            logger.warning("Redis GET failed for key=%s", key)
            return None

    async def set(self, key: str, value: str, ttl: int = 60) -> None:
        redis = self._get_redis()
        if redis is None:
            return
        try:
            await redis.set(key, value, ex=ttl)
        except Exception:
            logger.warning("Redis SET failed for key=%s", key)

    async def delete(self, *keys: str) -> None:
        if not keys:
            return
        redis = self._get_redis()
        if redis is None:
            return
        try:
            await redis.delete(*keys)
        except Exception:
            logger.warning("Redis DELETE failed for keys=%s", keys)

    async def delete_pattern(self, pattern: str) -> None:
        redis = self._get_redis()
        if redis is None:
            return
        try:
            cursor = 0
            while True:
                cursor, keys = await redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception:
            logger.warning("Redis DELETE_PATTERN failed for pattern=%s", pattern)

    async def bump_version(self, namespace: str) -> None:
        """Invalidate a namespace without scanning all Redis keys."""
        redis = self._get_redis()
        if redis is None:
            return
        try:
            await redis.incr(f"cache-version:{namespace}")
        except Exception:
            logger.warning("Redis version bump failed for namespace=%s", namespace)

    async def get_version(self, namespace: str) -> int:
        redis = self._get_redis()
        if redis is None:
            return 0
        try:
            value = await redis.get(f"cache-version:{namespace}")
            return int(value or 0)
        except Exception:
            logger.warning("Redis version read failed for namespace=%s", namespace)
            return 0

    async def get_or_set(self, key: str, factory: Callable, ttl: int = 60) -> str:
        value = await self.get(key)
        if value is not None:
            return value
        value = await factory()
        if value is not None:
            await self.set(key, value, ttl=ttl)
        return value


cache = RedisCache()


def get_feed_cache_key(
    page: int,
    per_page: int,
    sort: str,
    order: str,
    version: int,
    tags: str | None,
    emotion: str | None,
    year: int | None,
    month: int | None,
) -> str:
    # Hash user-controlled filters so unusual values cannot create oversized
    # Redis keys or alter key structure. Include every query dimension,
    # including order, to prevent cache collisions between feed variants.
    payload = json.dumps(
        {
            "page": page,
            "per_page": per_page,
            "sort": sort,
            "order": order,
            "tags": tags or "",
            "emotion": emotion or "",
            "year": year,
            "month": month,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"feed:v3:{version}:{hashlib.sha256(payload).hexdigest()}"


def get_profile_cache_key(username: str) -> str:
    return f"profile:{username}"


def get_unread_count_cache_key(user_id: str) -> str:
    return f"unread:{user_id}"


def get_popular_tags_cache_key() -> str:
    return "tags:popular"


def get_emotion_counts_cache_key() -> str:
    return "emotions:counts"
