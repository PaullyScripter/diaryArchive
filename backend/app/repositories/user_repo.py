from bson import ObjectId

from app.core.exceptions import ConflictException
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    collection_name = "users"

    async def get_by_username(self, username: str) -> dict | None:
        return await self.find_one({"username": username.lower()})

    async def get_by_email_hash(self, email_hash: str) -> dict | None:
        return await self.find_one({"email_hash": email_hash})

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

    def _to_object_id(self, id: str):
        return ObjectId(id)
