import logging
import re

from bson import ObjectId

from app.core.database import DatabaseManager
from app.core.exceptions import ConflictException
from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)

BANNED_USER_IDS_KEY = "banned_user_ids"
BANNED_USER_IDS_TTL = 300


class UserRepository(BaseRepository):
    collection_name = "users"

    async def get_by_username(self, username: str) -> dict | None:
        return await self.find_one({"username": username.lower()})

    async def get_by_email_hash(self, email_hash: str) -> dict | None:
        return await self.find_one({"email_hash": email_hash})

    async def get_by_email_hashes(self, email_hashes: list[str]) -> dict | None:
        if not email_hashes:
            return None
        return await self.find_one({"email_hash": {"$in": email_hashes}})

    async def find_by_ids(self, ids: list[str]) -> list[dict]:
        if not ids:
            return []
        oids = [ObjectId(uid) for uid in ids if ObjectId.is_valid(uid)]
        if not oids:
            return []
        return await self.find({"_id": {"$in": oids}}, limit=len(oids))

    async def create_user(self, data: dict) -> str:
        username = data.get("username", "").lower()
        existing = await self.get_by_username(username)
        if existing:
            raise ConflictException("Username is already taken")
        if data.get("email_hash"):
            existing_email = await self.get_by_email_hash(data["email_hash"])
            if existing_email:
                raise ConflictException("Email is already associated with another account")
        data["username"] = username
        user_id = await self.create(data)
        return str(user_id)

    async def update_stats(self, user_id: str, field: str, delta: int) -> None:
        await self._collection.update_one(
            {"_id": self._to_object_id(user_id)},
            {"$inc": {f"stats.{field}": delta}},
        )

    async def search_users(
        self,
        query: str | None = None,
        is_banned: bool | None = None,
        skip: int = 0,
        limit: int = 20,
        sort: list[tuple] | None = None,
    ) -> list[dict]:
        filter_dict: dict = {}
        if query:
            escaped = re.escape(query.lower())
            filter_dict["username"] = {"$regex": f"^{escaped}"}
        if is_banned is not None:
            filter_dict["is_banned"] = is_banned
        return await self.find(
            filter=filter_dict,
            sort=sort or [("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_users(
        self,
        query: str | None = None,
        is_banned: bool | None = None,
    ) -> int:
        filter_dict: dict = {}
        if query:
            escaped = re.escape(query.lower())
            filter_dict["username"] = {"$regex": f"^{escaped}"}
        if is_banned is not None:
            filter_dict["is_banned"] = is_banned
        return await self.count(filter_dict)

    async def count_admins(self) -> int:
        return await self.count({"is_admin": True})

    async def set_ban_status(self, user_id: str, is_banned: bool, ban_reason: str | None = None) -> bool:
        from datetime import UTC, datetime
        update_doc: dict = {"is_banned": is_banned}
        if is_banned:
            update_doc["banned_at"] = datetime.now(UTC)
            if ban_reason:
                update_doc["ban_reason"] = ban_reason
        else:
            update_doc["banned_at"] = None
            update_doc["ban_reason"] = None
        return await self.update(user_id, update_doc)

    async def set_admin_role(self, user_id: str, is_admin: bool) -> bool:
        return await self.update(user_id, {"is_admin": is_admin})

    async def get_banned_user_ids(self) -> list[ObjectId]:
        try:
            redis = DatabaseManager.get_redis()
        except (RuntimeError, AttributeError):
            redis = None
        if redis is not None:
            members = None
            try:
                members = await redis.smembers(BANNED_USER_IDS_KEY)
            except Exception:
                logger.warning("Failed to read banned user ids from Redis", exc_info=True)
            if members:
                return [ObjectId(m) for m in members if ObjectId.is_valid(m)]
        ids = await self._query_banned_user_ids()
        if redis is not None and ids:
            await self._cache_banned_user_ids(ids)
        return ids

    async def _query_banned_user_ids(self) -> list[ObjectId]:
        cursor = self._collection.find({"is_banned": True}, {"_id": 1})
        docs = await cursor.to_list(length=10000)
        return [d["_id"] for d in docs]

    async def _cache_banned_user_ids(self, ids: list[ObjectId]) -> None:
        if not ids:
            return
        try:
            redis = DatabaseManager.get_redis()
            await redis.delete(BANNED_USER_IDS_KEY)
            await redis.sadd(BANNED_USER_IDS_KEY, *(str(oid) for oid in ids))
            await redis.expire(BANNED_USER_IDS_KEY, BANNED_USER_IDS_TTL)
        except Exception:
            logger.warning("Failed to cache banned user ids in Redis", exc_info=True)

    async def refresh_banned_user_ids(self) -> list[ObjectId]:
        ids = await self._query_banned_user_ids()
        try:
            redis = DatabaseManager.get_redis()
            await redis.delete(BANNED_USER_IDS_KEY)
            if ids:
                await redis.sadd(BANNED_USER_IDS_KEY, *(str(oid) for oid in ids))
                await redis.expire(BANNED_USER_IDS_KEY, BANNED_USER_IDS_TTL)
        except Exception:
            logger.warning("Failed to refresh banned user ids in Redis", exc_info=True)
        return ids

    def _to_object_id(self, id: str):
        return ObjectId(id)
