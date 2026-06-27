from app.repositories.base import BaseRepository


class DiaryRepository(BaseRepository):
    collection_name = "diaries"

    async def find_public_by_user(
        self,
        user_id: str,
        sort: list[tuple] | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        if sort is None:
            sort = [("created_at", -1)]
        return await self.find(
            {"user_id": self._to_object_id(user_id), "privacy": "public"},
            sort=sort,
            skip=skip,
            limit=limit,
        )

    async def count_public_by_user(self, user_id: str) -> int:
        from bson import ObjectId
        return await self.count({
            "user_id": ObjectId(user_id),
            "privacy": "public",
        })

    def _to_object_id(self, id: str):
        from bson import ObjectId
        return ObjectId(id)
