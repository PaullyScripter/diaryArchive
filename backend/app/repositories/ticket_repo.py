from datetime import UTC, datetime

from bson import ObjectId

from app.repositories.base import BaseRepository

MAX_MESSAGES = 1000


class TicketRepository(BaseRepository):
    collection_name = "tickets"

    async def create_ticket(self, data: dict) -> str:
        data["status"] = "open"
        data["messages"] = []
        data["created_at"] = datetime.now(UTC)
        data["updated_at"] = datetime.now(UTC)
        result = await self.create(data)
        return str(result)

    async def find_by_user(self, user_id: str, skip: int = 0, limit: int = 20) -> list[dict]:
        return await self.find(
            filter={"user_id": ObjectId(user_id)},
            sort=[("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_by_user(self, user_id: str) -> int:
        return await self.count({"user_id": ObjectId(user_id)})

    async def find_all(
        self,
        status: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        filter_dict: dict = {}
        if status and status != "all":
            filter_dict["status"] = status
        return await self.find(
            filter=filter_dict,
            sort=[("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_all(self, status: str | None = None) -> int:
        filter_dict: dict = {}
        if status and status != "all":
            filter_dict["status"] = status
        return await self.count(filter_dict)

    async def assign_admin(self, ticket_id: str, admin_id: str, admin_username: str) -> bool:
        if not ObjectId.is_valid(ticket_id):
            return False
        result = await self._collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$set": {
                    "assigned_admin_id": ObjectId(admin_id),
                    "assigned_admin_username": admin_username,
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        return result.modified_count > 0

    async def add_message(self, ticket_id: str, message: dict) -> bool:
        if not ObjectId.is_valid(ticket_id):
            return False
        message["_id"] = ObjectId()
        message["created_at"] = datetime.now(UTC)
        result = await self._collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"messages": {"$each": [message], "$slice": -MAX_MESSAGES}},
                "$inc": {"messages_count": 1},
                "$set": {"updated_at": datetime.now(UTC)},
            },
        )
        return result.modified_count > 0

    async def set_message_count(self, ticket_id: str, count: int) -> None:
        if not ObjectId.is_valid(ticket_id):
            return
        await self._collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": {"messages_count": count}},
        )

    async def close_ticket(self, ticket_id: str) -> bool:
        if not ObjectId.is_valid(ticket_id):
            return False
        result = await self._collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$set": {
                    "status": "closed",
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        return result.modified_count > 0

    async def find_pending_appeal(self, user_id: str) -> dict | None:
        return await self.find_one(
            {
                "user_id": ObjectId(user_id),
                "category": "account_help",
                "status": "open",
            }
        )
