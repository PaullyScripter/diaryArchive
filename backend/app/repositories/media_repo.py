from bson import ObjectId

from app.repositories.base import BaseRepository


class MediaRepository(BaseRepository):
    collection_name = "media"

    def _oid(self, id_str: str) -> ObjectId:
        return ObjectId(id_str)

    async def find_by_user(
        self,
        user_id: str,
        diary_id: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        sort = [("created_at", -1)]
        query: dict = {"user_id": self._oid(user_id)}
        if diary_id:
            query["diary_id"] = self._oid(diary_id)
        return await self.find(query, sort=sort, skip=skip, limit=limit)

    async def count_by_user(
        self, user_id: str, diary_id: str | None = None
    ) -> int:
        query: dict = {"user_id": self._oid(user_id)}
        if diary_id:
            query["diary_id"] = self._oid(diary_id)
        return await self.count(query)

    async def find_by_diary(self, diary_id: str) -> list[dict]:
        return await self.find(
            {"diary_id": self._oid(diary_id)},
            sort=[("created_at", -1)],
            limit=500,
        )

    async def delete_by_diary(self, diary_id: str) -> int:
        result = await self._collection.delete_many(
            {"diary_id": self._oid(diary_id)}
        )
        return result.deleted_count

    async def get_by_id(self, media_id: str) -> dict | None:
        if not ObjectId.is_valid(media_id):
            return None
        return await self.find_one({"_id": ObjectId(media_id)})

    async def attach_to_diary(
        self, media_ids: list[str], user_id: str, diary_id: str
    ) -> int:
        """Attach owned, currently-unassigned media to a diary."""
        valid_ids = [ObjectId(media_id) for media_id in media_ids if ObjectId.is_valid(media_id)]
        if not valid_ids or not ObjectId.is_valid(user_id) or not ObjectId.is_valid(diary_id):
            return 0
        result = await self._collection.update_many(
            {
                "_id": {"$in": valid_ids},
                "user_id": ObjectId(user_id),
                "$or": [{"diary_id": None}, {"diary_id": ObjectId(diary_id)}],
            },
            {"$set": {"diary_id": ObjectId(diary_id)}},
        )
        return result.modified_count
