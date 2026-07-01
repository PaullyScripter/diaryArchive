from datetime import UTC, datetime, timedelta

from app.repositories.base import BaseRepository


class RefreshTokenRepository(BaseRepository):
    collection_name = "refresh_tokens"

    async def create_token(self, user_id: str, token_hash: str, days: int = 7) -> str:
        doc = {
            "user_id": user_id,
            "token_hash": token_hash,
            "expires_at": datetime.now(UTC) + timedelta(days=days),
            "created_at": datetime.now(UTC),
        }
        return str(await self.create(doc))

    async def find_by_hash(self, token_hash: str) -> dict | None:
        return await self.find_one({"token_hash": token_hash})

    async def delete_by_hash(self, token_hash: str) -> bool:
        result = await self._collection.delete_one({"token_hash": token_hash})
        return result.deleted_count > 0

    async def find_one_and_delete(self, token_hash: str) -> dict | None:
        result = await self._collection.find_one_and_delete(
            {"token_hash": token_hash},
            {"expires_at": 1, "user_id": 1},
        )
        return result

    async def delete_all_for_user(self, user_id: str) -> int:
        result = await self._collection.delete_many({"user_id": user_id})
        return result.deleted_count
