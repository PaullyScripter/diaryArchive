from datetime import UTC, datetime, timedelta

from app.repositories.base import BaseRepository


class EmailVerificationTokenRepository(BaseRepository):
    collection_name = "email_verification_tokens"

    async def create_token(self, user_id: str, token_hash: str) -> str:
        doc = {
            "user_id": user_id,
            "token_hash": token_hash,
            "expires_at": datetime.now(UTC) + timedelta(hours=1),
            "used": False,
            "created_at": datetime.now(UTC),
        }
        return str(await self.create(doc))

    async def find_and_consume(self, token_hash: str) -> dict | None:
        """Atomically claim an unused, non-expired token (single use)."""
        return await self._collection.find_one_and_update(
            {
                "token_hash": token_hash,
                "used": False,
                "expires_at": {"$gt": datetime.now(UTC)},
            },
            {"$set": {"used": True}},
            return_document=True,
        )

    async def delete_for_user(self, user_id: str) -> int:
        result = await self._collection.delete_many({"user_id": user_id})
        return result.deleted_count