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
    tags: str | None,
    emotion: str | None,
    year: int | None,
    month: int | None,
) -> str:
    parts = [f"feed:{page}:{per_page}:{sort}"]
    if tags:
        parts.append(f"t:{tags}")
    if emotion:
        parts.append(f"e:{emotion}")
    if year:
        parts.append(f"y:{year}")
    if month:
        parts.append(f"m:{month}")
    return ":".join(parts)


def get_profile_cache_key(username: str) -> str:
    return f"profile:{username}"


def get_unread_count_cache_key(user_id: str) -> str:
    return f"unread:{user_id}"


def get_popular_tags_cache_key() -> str:
    return "tags:popular"


def get_emotion_counts_cache_key() -> str:
    return "emotions:counts"
