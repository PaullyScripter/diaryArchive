from datetime import UTC, datetime, timedelta

from app.repositories.base import BaseRepository


class PasswordResetTokenRepository(BaseRepository):
    collection_name = "password_reset_tokens"

    async def create_token(self, user_id: str, token_hash: str) -> str:
        doc = {
            "user_id": user_id,
            "token_hash": token_hash,
            "expires_at": datetime.now(UTC) + timedelta(hours=1),
            "used": False,
            "created_at": datetime.now(UTC),
        }
        return str(await self.create(doc))

    async def find_by_hash(self, token_hash: str) -> dict | None:
        return await self.find_one({"token_hash": token_hash, "used": False})

    async def mark_used(self, token_hash: str) -> bool:
        result = await self._collection.update_one(
            {"token_hash": token_hash}, {"$set": {"used": True}}
        )
        return result.modified_count > 0
