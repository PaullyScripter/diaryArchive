from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings


class DatabaseManager:
    _client: AsyncIOMotorClient | None = None
    _redis_pool: ConnectionPool | None = None
    _redis: Redis | None = None

    @classmethod
    async def connect_mongo(cls) -> AsyncIOMotorClient:
        if cls._client is None:
            cls._client = AsyncIOMotorClient(
                settings.mongodb_uri,
                maxPoolSize=settings.mongodb_max_pool_size,
                minPoolSize=settings.mongodb_min_pool_size,
                maxIdleTimeMS=30000,
                connectTimeoutMS=5000,
                serverSelectionTimeoutMS=5000,
                heartbeatFrequencyMS=10000,
            )
        return cls._client

    @classmethod
    async def connect_redis(cls) -> Redis:
        if cls._redis_pool is None:
            cls._redis_pool = ConnectionPool.from_url(
                settings.redis_url,
                max_connections=50,
                decode_responses=True,
            )
        if cls._redis is None:
            cls._redis = Redis(connection_pool=cls._redis_pool)
        return cls._redis

    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        if cls._client is None:
            raise RuntimeError("MongoDB not connected. Call connect_mongo() first.")
        return cls._client.diaryarchive

    @classmethod
    def get_redis(cls) -> Redis:
        if cls._redis is None:
            raise RuntimeError("Redis not connected. Call connect_redis() first.")
        return cls._redis

    @classmethod
    async def close_mongo(cls) -> None:
        if cls._client is not None:
            cls._client.close()
            cls._client = None

    @classmethod
    async def close_redis(cls) -> None:
        if cls._redis is not None:
            await cls._redis.aclose()
            cls._redis = None
        if cls._redis_pool is not None:
            await cls._redis_pool.disconnect()
            cls._redis_pool = None
