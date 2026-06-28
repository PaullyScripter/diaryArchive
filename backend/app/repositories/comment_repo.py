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
            {"diary_id": ObjectId(diary_id), "parent_comment_id": None, "is_deleted": {"$ne": True}},
            sort=[("created_at", 1)],
            skip=skip,
            limit=limit,
        )

    async def find_replies(self, parent_id: str, skip: int = 0, limit: int = 10) -> list[dict]:
        return await self.find(
            {"parent_comment_id": ObjectId(parent_id)},
            sort=[("created_at", 1)],
            skip=skip,
            limit=limit,
        )

    async def count_replies(self, parent_id: str) -> int:
        return await self.count({"parent_comment_id": ObjectId(parent_id)})

    async def count_by_diary(self, diary_id: str) -> int:
        return await self.count({
            "diary_id": ObjectId(diary_id),
            "is_deleted": {"$ne": True},
            "parent_comment_id": None,
        })

    async def inc_reply_count(self, comment_id: str, delta: int) -> None:
        await self._collection.update_one(
            {"_id": ObjectId(comment_id)},
            {"$inc": {"reply_count": delta}},
        )

    async def inc_like_count(self, comment_id: str, delta: int) -> None:
        await self._collection.update_one(
            {"_id": ObjectId(comment_id)},
            {"$inc": {"like_count": delta}},
        )

    async def soft_delete(self, comment_id: str) -> bool:
        if not ObjectId.is_valid(comment_id):
            return False
        from datetime import UTC, datetime

        now = datetime.now(UTC)
        result = await self._collection.update_one(
            {"_id": ObjectId(comment_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "content": None,
                    "deleted_at": now,
                    "updated_at": now,
                }
            },
        )
        return result.modified_count > 0

    async def delete_by_diary(self, diary_id: str) -> int:
        result = await self._collection.delete_many(
            {"diary_id": ObjectId(diary_id)}
        )
        return result.deleted_count

    async def has_comment_like(self, comment_id: str, user_id: str) -> bool:
        db = self._collection.database
        doc = await db.comment_likes.find_one({
            "comment_id": ObjectId(comment_id),
            "user_id": ObjectId(user_id),
        })
        return doc is not None

    async def add_comment_like(self, comment_id: str, user_id: str) -> None:
        from datetime import UTC, datetime
        db = self._collection.database
        await db.comment_likes.insert_one({
            "comment_id": ObjectId(comment_id),
            "user_id": ObjectId(user_id),
            "created_at": datetime.now(UTC),
        })

    async def remove_comment_like(self, comment_id: str, user_id: str) -> None:
        db = self._collection.database
        await db.comment_likes.delete_one({
            "comment_id": ObjectId(comment_id),
            "user_id": ObjectId(user_id),
        })

    async def find_one_and_delete_comment_like(self, comment_id: str, user_id: str) -> dict | None:
        db = self._collection.database
        return await db.comment_likes.find_one_and_delete({
            "comment_id": ObjectId(comment_id),
            "user_id": ObjectId(user_id),
        })

    async def batch_has_comment_likes(self, comment_ids: list[str], user_id: str) -> set[str]:
        if not comment_ids:
            return set()
        db = self._collection.database
        oids = [ObjectId(cid) for cid in comment_ids if ObjectId.is_valid(cid)]
        if not oids:
            return set()
        docs = await db.comment_likes.find({
            "comment_id": {"$in": oids},
            "user_id": ObjectId(user_id),
        }).to_list(length=len(oids))
        return {str(d["comment_id"]) for d in docs}
