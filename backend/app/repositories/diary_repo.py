import random as _random

from bson import ObjectId

from app.repositories.base import BaseRepository


class DiaryRepository(BaseRepository):
    collection_name = "diaries"

    def _oid(self, id_str: str) -> ObjectId:
        return ObjectId(id_str)

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
            {"user_id": self._oid(user_id), "privacy": "public"},
            sort=sort,
            skip=skip,
            limit=limit,
        )

    async def count_public_by_user(self, user_id: str) -> int:
        return await self.count({
            "user_id": self._oid(user_id),
            "privacy": "public",
        })

    async def find_public_feed(
        self,
        skip: int = 0,
        limit: int = 20,
        sort_field: str = "created_at",
        sort_dir: int = -1,
    ) -> list[dict]:
        return await self.find(
            {"privacy": "public"},
            sort=[(sort_field, sort_dir)],
            skip=skip,
            limit=limit,
        )

    async def count_public_feed(self) -> int:
        return await self.count({"privacy": "public"})

    async def find_public_feed_filtered(
        self,
        tags: list[str] | None = None,
        emotion: str | None = None,
        year: int | None = None,
        month: int | None = None,
        skip: int = 0,
        limit: int = 20,
        sort_field: str = "created_at",
        sort_dir: int = -1,
    ) -> list[dict]:
        query: dict = {"privacy": "public"}
        if tags:
            query["tags"] = {"$in": tags}
        if emotion:
            query["emotion"] = emotion
        if year is not None:
            query["year"] = year
        if month is not None:
            query["month"] = month
        return await self.find(
            query,
            sort=[(sort_field, sort_dir)],
            skip=skip,
            limit=limit,
        )

    async def count_public_feed_filtered(
        self,
        tags: list[str] | None = None,
        emotion: str | None = None,
        year: int | None = None,
        month: int | None = None,
    ) -> int:
        query: dict = {"privacy": "public"}
        if tags:
            query["tags"] = {"$in": tags}
        if emotion:
            query["emotion"] = emotion
        if year is not None:
            query["year"] = year
        if month is not None:
            query["month"] = month
        return await self.count(query)

    async def find_random_public(self) -> dict | None:
        count = await self.count_public_feed()
        if count == 0:
            return None
        skip = _random.randint(0, max(0, count - 1))
        results = await self.find(
            {"privacy": "public"},
            sort=[("_id", 1)],
            skip=skip,
            limit=1,
        )
        return results[0] if results else None

    async def find_user_diaries(
        self,
        user_id: str,
        privacy: str | None = None,
        skip: int = 0,
        limit: int = 20,
        sort: list[tuple] | None = None,
    ) -> list[dict]:
        if sort is None:
            sort = [("created_at", -1)]
        query: dict = {"user_id": self._oid(user_id)}
        if privacy:
            query["privacy"] = privacy
        return await self.find(query, sort=sort, skip=skip, limit=limit)

    async def count_user_diaries(self, user_id: str, privacy: str | None = None) -> int:
        query: dict = {"user_id": self._oid(user_id)}
        if privacy:
            query["privacy"] = privacy
        return await self.count(query)

    async def delete_cascade(self, diary_id: str) -> int:
        oid = self._oid(diary_id)
        db = self._collection.database
        await db.comments.delete_many({"diary_id": oid})
        await db.likes.delete_many({"diary_id": oid})
        await db.bookmarks.delete_many({"diary_id": oid})
        result = await self._collection.delete_one({"_id": oid})
        return result.deleted_count
