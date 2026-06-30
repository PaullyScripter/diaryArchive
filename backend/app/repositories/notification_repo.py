from bson import ObjectId

from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository):
    collection_name = "notifications"

    async def find_by_user(
        self, user_id: str, skip: int = 0, limit: int = 20
    ) -> list[dict]:
        return await self.find(
            {"user_id": ObjectId(user_id)},
            sort=[("read", 1), ("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_by_user(self, user_id: str) -> int:
        return await self.count({"user_id": ObjectId(user_id)})

    async def count_unread(self, user_id: str) -> int:
        return await self.count({
            "user_id": ObjectId(user_id),
            "read": False,
        })

    async def mark_read(self, notification_id: str, user_id: str) -> bool:
        if not ObjectId.is_valid(notification_id):
            return False
        result = await self._collection.update_one(
            {"_id": ObjectId(notification_id), "user_id": ObjectId(user_id)},
            {"$set": {"read": True}},
        )
        return result.modified_count > 0

    async def mark_all_read(self, user_id: str) -> int:
        result = await self._collection.update_many(
            {"user_id": ObjectId(user_id), "read": False},
            {"$set": {"read": True}},
        )
        return result.modified_count
