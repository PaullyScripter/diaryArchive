import json
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query

from app.core.database import DatabaseManager
from app.models.diary import VALID_EMOTIONS

router = APIRouter(tags=["discover"])
logger = logging.getLogger(__name__)


@router.get("/tags/popular")
async def popular_tags(
    limit: int = Query(50, ge=1, le=100),
    days: int = Query(90, ge=1, le=365),
):
    cache_key = f"tags:popular:{days}:{limit}"
    try:
        redis = DatabaseManager.get_redis()
        cached = await redis.get(cache_key)
        if cached:
            return {"data": json.loads(cached)}
    except RuntimeError:
        pass

    since = datetime.now(UTC) - timedelta(days=days)
    db = DatabaseManager.get_db()
    pipeline = [
        {"$match": {"privacy": "public", "created_at": {"$gte": since}}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
        {"$project": {"tag": "$_id", "count": 1, "_id": 0}},
    ]
    cursor = db.diaries.aggregate(pipeline)
    tags = await cursor.to_list(length=limit)

    try:
        redis = DatabaseManager.get_redis()
        await redis.setex(cache_key, 300, json.dumps(tags))
    except RuntimeError:
        pass

    return {"data": tags}


@router.get("/emotions")
async def emotions(
    days: int = Query(90, ge=1, le=365),
):
    cache_key = f"emotions:counts:v2:{days}"
    try:
        redis = DatabaseManager.get_redis()
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except RuntimeError:
        pass

    since = datetime.now(UTC) - timedelta(days=days)
    db = DatabaseManager.get_db()

    total_pipeline = [
        {"$match": {"privacy": "public", "is_deleted": {"$ne": True}}},
        {"$count": "total"},
    ]
    total_cursor = db.diaries.aggregate(total_pipeline)
    total_docs = await total_cursor.to_list(length=1)
    total_count = total_docs[0]["total"] if total_docs else 0

    pipeline = [
        {
            "$match": {
                "privacy": "public",
                "is_deleted": {"$ne": True},
                "emotion": {"$ne": None},
                "created_at": {"$gte": since},
            }
        },
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

    response = {"data": result, "total": total_count}

    try:
        redis = DatabaseManager.get_redis()
        await redis.setex(cache_key, 300, json.dumps(response))
    except RuntimeError:
        pass

    return response
