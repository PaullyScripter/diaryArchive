from bson import ObjectId

from app.repositories.base import BaseRepository


class CommentRepository(BaseRepository):
    collection_name = "comments"

    async def find_by_diary(
        self,
        diary_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        return await self.find(
            {"diary_id": ObjectId(diary_id)},
            sort=[("created_at", 1)],
            skip=skip,
            limit=limit,
        )

    async def count_by_diary(self, diary_id: str) -> int:
        return await self.count({"diary_id": ObjectId(diary_id)})

    async def soft_delete(self, comment_id: str) -> bool:
        if not ObjectId.is_valid(comment_id):
            return False
        from datetime import UTC, datetime

        result = await self._collection.update_one(
            {"_id": ObjectId(comment_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "content": "[deleted]",
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        return result.modified_count > 0

    async def delete_by_diary(self, diary_id: str) -> int:
        result = await self._collection.delete_many(
            {"diary_id": ObjectId(diary_id)}
        )
        return result.deleted_count
