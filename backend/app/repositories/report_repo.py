from datetime import UTC, datetime

from bson import ObjectId

from app.repositories.base import BaseRepository


class ReportRepository(BaseRepository):
    collection_name = "reports"

    async def create_report(self, data: dict) -> str:
        data["status"] = "pending"
        data["created_at"] = datetime.now(UTC)
        result = await self.create(data)
        return str(result)

    async def find_duplicate(
        self, reporter_id: str, target_type: str, target_id: str
    ) -> dict | None:
        return await self.find_one({
            "reporter_id": ObjectId(reporter_id),
            "target_type": target_type,
            "target_id": ObjectId(target_id),
            "status": "pending",
        })

    async def find_reports(
        self,
        status: str | None = None,
        sort: list[tuple] | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        filter_dict: dict = {}
        if status and status != "all":
            filter_dict["status"] = status
        return await self.find(
            filter=filter_dict,
            sort=sort or [("created_at", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_reports(self, status: str | None = None) -> int:
        filter_dict: dict = {}
        if status and status != "all":
            filter_dict["status"] = status
        return await self.count(filter_dict)

    async def resolve_report(
        self, report_id: str, admin_id: str, status: str, resolution_note: str | None = None
    ) -> bool:
        if not ObjectId.is_valid(report_id):
            return False
        update_data: dict = {
            "status": status,
            "resolved_by": admin_id,
            "resolved_at": datetime.now(UTC),
        }
        if resolution_note:
            update_data["resolution_note"] = resolution_note
        result = await self._collection.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": update_data},
        )
        return result.modified_count > 0
