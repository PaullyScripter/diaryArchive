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

    async def find_one_and_delete(self, follower_id: str, following_id: str) -> dict | None:
        return await self._collection.find_one_and_delete({
            "follower_id": ObjectId(follower_id),
            "following_id": ObjectId(following_id),
        })

    async def get_following_ids(self, follower_id: str, limit: int = 1000) -> list[str]:
        docs = await self.find(
            {"follower_id": ObjectId(follower_id)},
            sort=[("created_at", -1)],
            limit=limit,
        )
        return [str(d["following_id"]) for d in docs]

    async def find_following_by_ids(self, follower_id: str, following_ids: list[str]) -> set[str]:
        if not following_ids:
            return set()
        oids = [ObjectId(fid) for fid in following_ids if ObjectId.is_valid(fid)]
        if not oids:
            return set()
        docs = await self.find({
            "follower_id": ObjectId(follower_id),
            "following_id": {"$in": oids},
        }, limit=len(oids))
        return {str(d["following_id"]) for d in docs}
