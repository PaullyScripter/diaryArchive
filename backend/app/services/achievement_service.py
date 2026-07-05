import logging
from datetime import UTC, datetime

from bson import ObjectId

from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)

ACHIEVEMENTS = {
    "diary_5":   {"type": "diaries",  "tier": "bronze",   "threshold": 5,      "color": "#8B6914", "label": "5 Diaries"},
    "diary_50":  {"type": "diaries",  "tier": "silver",   "threshold": 50,     "color": "#A8A8A8", "label": "50 Diaries"},
    "diary_200": {"type": "diaries",  "tier": "gold",     "threshold": 200,    "color": "#DAA520", "label": "200 Diaries"},
    "diary_500": {"type": "diaries",  "tier": "diamond",  "threshold": 500,    "color": "#B9F2FF", "label": "500 Diaries",  "shine": True},
    "diary_1000":{"type": "diaries",  "tier": "gradient", "threshold": 1000,   "color": "linear-gradient(135deg, #87CEEB, #9B59B6)", "label": "1000+ Diaries", "shine": True},
    "likes_100":    {"type": "likes", "tier": "bronze",   "threshold": 100,     "color": "#8B6914", "label": "100 Likes",     "icon": "heart"},
    "likes_1000":   {"type": "likes", "tier": "silver",   "threshold": 1000,    "color": "#A8A8A8", "label": "1K Likes",      "icon": "heart"},
    "likes_10000":  {"type": "likes", "tier": "gold",     "threshold": 10000,   "color": "#DAA520", "label": "10K Likes",     "icon": "heart"},
    "likes_100000": {"type": "likes", "tier": "diamond",  "threshold": 100000,  "color": "#B9F2FF", "label": "100K Likes",    "icon": "heart", "shine": True},
    "likes_1000000":{"type": "likes", "tier": "gradient", "threshold": 1000000, "color": "linear-gradient(135deg, #87CEEB, #9B59B6)", "label": "1M Likes", "icon": "heart", "shine": True},
}


async def check_and_award_diary_achievements(user_id: str) -> list[dict]:
    from app.repositories.diary_repo import DiaryRepository
    count = await DiaryRepository().count_user_diaries(user_id, "public")
    return await _award("diaries", count, user_id)


async def check_and_award_likes_achievements(user_id: str) -> list[dict]:
    from app.repositories.diary_repo import DiaryRepository
    user_repo = UserRepository()
    from app.repositories.like_repo import LikeRepository
    diaries = await DiaryRepository().find_user_diaries(user_id, limit=2000)
    total_likes = sum(d.get("stats", {}).get("like_count", 0) for d in diaries)
    return await _award("likes", total_likes, user_id)


async def _award(ach_type: str, count: int, user_id: str) -> list[dict]:
    from app.core.database import DatabaseManager
    db = DatabaseManager.get_db()
    awarded = []
    for key, ach in ACHIEVEMENTS.items():
        if ach["type"] != ach_type:
            continue
        if count < ach["threshold"]:
            continue
        try:
            doc = {
                "user_id": ObjectId(user_id),
                "type": ach_type,
                "tier": ach["tier"],
                "threshold": ach["threshold"],
                "label": ach["label"],
                "color": ach["color"],
                "icon": ach.get("icon", "book"),
                "shine": ach.get("shine", False),
                "awarded_at": datetime.now(UTC),
            }
            await db.achievements.insert_one(doc)
            awarded.append({k: str(v) if isinstance(v, ObjectId) else v for k, v in doc.items()})
            logger.info("Achievement awarded: %s to %s", key, user_id)
        except Exception:
            pass
    return awarded


async def get_user_achievements(user_id: str) -> list[dict]:
    from app.core.database import DatabaseManager
    db = DatabaseManager.get_db()
    cursor = db.achievements.find({"user_id": ObjectId(user_id)}).sort("threshold", 1)
    docs = await cursor.to_list(length=50)
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "type": d["type"],
            "tier": d["tier"],
            "threshold": d["threshold"],
            "label": d["label"],
            "color": d["color"],
            "icon": d.get("icon", "book"),
            "shine": d.get("shine", False),
            "awarded_at": d["awarded_at"].isoformat() if d.get("awarded_at") else None,
        })
    return result


async def get_displayed_badge(user_id: str) -> dict | None:
    user_repo = UserRepository()
    user = await user_repo.get_by_id(user_id)
    if not user or not user.get("displayed_badge"):
        return None
    badge = user["displayed_badge"]
    return {
        "type": badge.get("type", "diaries"),
        "tier": badge.get("tier", "bronze"),
        "label": badge.get("label", ""),
        "color": badge.get("color", "#8B6914"),
        "icon": badge.get("icon", "book"),
        "shine": badge.get("shine", False),
    }


async def set_displayed_badge(user_id: str, achievement_id: str) -> dict | None:
    from app.core.database import DatabaseManager
    db = DatabaseManager.get_db()
    ach = await db.achievements.find_one({"_id": ObjectId(achievement_id), "user_id": ObjectId(user_id)})
    if not ach:
        return None
    badge = {
        "displayed_badge": {
            "type": ach["type"],
            "tier": ach["tier"],
            "threshold": ach["threshold"],
            "label": ach["label"],
            "color": ach["color"],
            "icon": ach.get("icon", "book"),
            "shine": ach.get("shine", False),
        }
    }
    await UserRepository().update(user_id, badge)
    return badge["displayed_badge"]
