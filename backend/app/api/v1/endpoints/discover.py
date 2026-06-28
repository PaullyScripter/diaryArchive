from fastapi import APIRouter, Query

from app.core.database import DatabaseManager
from app.models.diary import VALID_EMOTIONS

router = APIRouter(tags=["discover"])


@router.get("/tags/popular")
async def popular_tags(limit: int = Query(50, ge=1, le=100)):
    db = DatabaseManager.get_db()
    pipeline = [
        {"$match": {"privacy": "public"}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
        {"$project": {"tag": "$_id", "count": 1, "_id": 0}},
    ]
    cursor = db.diaries.aggregate(pipeline)
    tags = await cursor.to_list(length=limit)
    return {"data": tags}


@router.get("/emotions")
async def emotions():
    db = DatabaseManager.get_db()
    pipeline = [
        {"$match": {"privacy": "public", "emotion": {"$ne": None}}},
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$project": {"emotion": "$_id", "count": 1, "_id": 0}},
    ]
    cursor = db.diaries.aggregate(pipeline)
    result = await cursor.to_list(length=50)

    existing = {e["emotion"] for e in result}
    for emotion in sorted(VALID_EMOTIONS):
        if emotion not in existing:
            result.append({"emotion": emotion, "count": 0})

    return {"data": result}
