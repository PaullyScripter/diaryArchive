from datetime import UTC, datetime, timedelta

from pymongo import ReturnDocument

from app.repositories.base import BaseRepository

# Absolute session lifetime: 30 days from original login.
MAX_SESSION_LIFETIME_DAYS = 30


class RefreshTokenRepository(BaseRepository):
    collection_name = "refresh_tokens"

    async def create_token(
        self,
        user_id: str,
        token_hash: str,
        days: int = 7,
        original_login_at: datetime | None = None,
        family_id: str | None = None,
        parent_token_hash: str | None = None,
    ) -> str:
        now = datetime.now(UTC)
        doc = {
            "user_id": user_id,
            "token_hash": token_hash,
            "expires_at": now + timedelta(days=days),
            "original_login_at": original_login_at or now,
            "created_at": now,
            "family_id": family_id or token_hash,
            "parent_token_hash": parent_token_hash,
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
            {"expires_at": 1, "user_id": 1, "original_login_at": 1},
        )
        return result

    async def consume_token(self, token_hash: str) -> dict | None:
        """Atomically mark a refresh token as used exactly once."""
        return await self._collection.find_one_and_update(
            {
                "token_hash": token_hash,
                "used_at": {"$exists": False},
                "revoked_at": {"$exists": False},
            },
            {"$set": {"used_at": datetime.now(UTC)}},
            projection={
                "expires_at": 1,
                "user_id": 1,
                "original_login_at": 1,
                "family_id": 1,
            },
            return_document=ReturnDocument.BEFORE,
        )

    async def revoke_family(self, family_id: str) -> int:
        result = await self._collection.update_many(
            {"family_id": family_id, "revoked_at": {"$exists": False}},
            {"$set": {"revoked_at": datetime.now(UTC)}},
        )
        return result.modified_count

    async def delete_all_for_user(self, user_id: str) -> int:
        result = await self._collection.delete_many({"user_id": user_id})
        return result.deleted_count
