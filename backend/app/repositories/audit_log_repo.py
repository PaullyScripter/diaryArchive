from datetime import UTC, datetime

from bson import ObjectId

from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository):
    collection_name = "audit_logs"

    async def create_log(self, data: dict) -> str:
        data["created_at"] = datetime.now(UTC)
        result = await self.create(data)
        return str(result)

    async def find_logs(
        self,
        action: str | None = None,
        admin_id: str | None = None,
        target_type: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        sort: list[tuple] | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        filter_dict: dict = {}
        if action:
            filter_dict["action"] = action
        if admin_id and ObjectId.is_valid(admin_id):
            filter_dict["admin_id"] = ObjectId(admin_id)
        if target_type:
            filter_dict["target_type"] = target_type
        if from_date or to_date:
            date_filter: dict = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            if date_filter:
                filter_dict["created_at"] = date_filter
        return await self.find(
            filter=filter_dict,
            sort=sort or [("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_logs(
        self,
        action: str | None = None,
        admin_id: str | None = None,
        target_type: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> int:
        filter_dict: dict = {}
        if action:
            filter_dict["action"] = action
        if admin_id and ObjectId.is_valid(admin_id):
            filter_dict["admin_id"] = ObjectId(admin_id)
        if target_type:
            filter_dict["target_type"] = target_type
        if from_date or to_date:
            date_filter: dict = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            if date_filter:
                filter_dict["created_at"] = date_filter
        return await self.count(filter_dict)
