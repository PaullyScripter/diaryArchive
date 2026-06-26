from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.database import DatabaseManager


class BaseRepository:
    collection_name: str = ""

    @property
    def _collection(self) -> AsyncIOMotorCollection:
        return DatabaseManager.get_db()[self.collection_name]

    async def get_by_id(self, id: str) -> dict | None:
        if not ObjectId.is_valid(id):
            return None
        return await self._collection.find_one({"_id": ObjectId(id)})

    async def find(
        self,
        filter: dict | None = None,
        sort: list[tuple] | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        cursor = self._collection.find(filter or {})
        if sort:
            cursor = cursor.sort(sort)
        cursor = cursor.skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def find_one(self, filter: dict) -> dict | None:
        return await self._collection.find_one(filter)

    async def create(self, data: dict) -> ObjectId:
        result = await self._collection.insert_one(data)
        return result.inserted_id

    async def update(self, id: str, data: dict) -> bool:
        if not ObjectId.is_valid(id):
            return False
        result = await self._collection.update_one(
            {"_id": ObjectId(id)}, {"$set": data}
        )
        return result.modified_count > 0

    async def delete(self, id: str) -> bool:
        if not ObjectId.is_valid(id):
            return False
        result = await self._collection.delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0

    async def count(self, filter: dict | None = None) -> int:
        return await self._collection.count_documents(filter or {})
