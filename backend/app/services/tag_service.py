import re

from app.core.database import DatabaseManager


def _escape_regex(s: str) -> str:
    return re.escape(s)


async def search_tags(query: str, limit: int = 10) -> list[dict]:
    db = DatabaseManager.get_db()
    safe_query = _escape_regex(query.strip())
    pipeline = [
        {"$match": {"privacy": "public"}},
        {"$unwind": "$tags"},
        {"$match": {"tags": {"$regex": f"^{safe_query}", "$options": "i"}}},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
        {"$project": {"name": "$_id", "count": 1, "_id": 0}},
    ]
    cursor = db.diaries.aggregate(pipeline)
    return await cursor.to_list(length=limit)