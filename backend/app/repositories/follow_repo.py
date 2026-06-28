from bson import ObjectId

from app.repositories.base import BaseRepository


class FollowRepository(BaseRepository):
    collection_name = "follows"

    async def find_by_follower_and_following(
        self, follower_id: str, following_id: str
    ) -> dict | None:
        return await self.find_one({
            "follower_id": ObjectId(follower_id),
            "following_id": ObjectId(following_id),
        })

    async def find_followers(
        self, user_id: str, skip: int = 0, limit: int = 20
    ) -> list[dict]:
        return await self.find(
            {"following_id": ObjectId(user_id)},
            sort=[("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def find_following(
        self, user_id: str, skip: int = 0, limit: int = 20
    ) -> list[dict]:
        return await self.find(
            {"follower_id": ObjectId(user_id)},
            sort=[("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_followers(self, user_id: str) -> int:
        return await self.count({"following_id": ObjectId(user_id)})

    async def count_following(self, user_id: str) -> int:
        return await self.count({"follower_id": ObjectId(user_id)})

    async def delete_by_pair(self, follower_id: str, following_id: str) -> int:
        result = await self._collection.delete_one({
            "follower_id": ObjectId(follower_id),
            "following_id": ObjectId(following_id),
        })
        return result.deleted_count
