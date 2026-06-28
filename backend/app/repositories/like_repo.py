from bson import ObjectId

from app.repositories.base import BaseRepository


class LikeRepository(BaseRepository):
    collection_name = "likes"

    async def find_by_user_and_diary(self, user_id: str, diary_id: str) -> dict | None:
        return await self.find_one({
            "user_id": ObjectId(user_id),
            "diary_id": ObjectId(diary_id),
        })

    async def find_by_user_and_diary_ids(
        self, user_id: str, diary_ids: list[str]
    ) -> list[dict]:
        oids = [ObjectId(did) for did in diary_ids]
        return await self.find({
            "user_id": ObjectId(user_id),
            "diary_id": {"$in": oids},
        }, limit=len(diary_ids))

    async def find_by_user(
        self, user_id: str, skip: int = 0, limit: int = 20
    ) -> list[dict]:
        return await self.find(
            {"user_id": ObjectId(user_id)},
            sort=[("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_by_user(self, user_id: str) -> int:
        return await self.count({"user_id": ObjectId(user_id)})

    async def delete_by_user_and_diary(self, user_id: str, diary_id: str) -> int:
        result = await self._collection.delete_one({
            "user_id": ObjectId(user_id),
            "diary_id": ObjectId(diary_id),
        })
        return result.deleted_count

    async def find_one_and_delete(self, user_id: str, diary_id: str) -> dict | None:
        return await self._collection.find_one_and_delete({
            "user_id": ObjectId(user_id),
            "diary_id": ObjectId(diary_id),
        })

    async def delete_by_diary(self, diary_id: str) -> int:
        result = await self._collection.delete_many(
            {"diary_id": ObjectId(diary_id)}
        )
        return result.deleted_count
