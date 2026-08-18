import logging
from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)

ACHIEVEMENTS = {
    "diary_5":    {"type": "diaries",   "tier": "bronze",   "threshold": 5,       "color": "#8B6914", "label": "5 Diaries"},
    "diary_50":   {"type": "diaries",   "tier": "silver",   "threshold": 50,      "color": "#A8A8A8", "label": "50 Diaries"},
    "diary_200":  {"type": "diaries",   "tier": "gold",     "threshold": 200,     "color": "#DAA520", "label": "200 Diaries"},
    "diary_500":  {"type": "diaries",   "tier": "diamond",  "threshold": 500,     "color": "#B9F2FF", "label": "500 Diaries",   "shine": True},
    "diary_1000": {"type": "diaries",   "tier": "gradient", "threshold": 1000,    "color": "linear-gradient(135deg, #87CEEB, #9B59B6)", "label": "1000+ Diaries", "shine": True},
    "likes_100":     {"type": "likes",  "tier": "bronze",   "threshold": 100,      "color": "#8B6914", "label": "100 Likes",      "icon": "heart"},
    "likes_1000":    {"type": "likes",  "tier": "silver",   "threshold": 1000,     "color": "#A8A8A8", "label": "1K Likes",       "icon": "heart"},
    "likes_10000":   {"type": "likes",  "tier": "gold",     "threshold": 10000,    "color": "#DAA520", "label": "10K Likes",      "icon": "heart"},
    "likes_100000":  {"type": "likes",  "tier": "diamond",  "threshold": 100000,   "color": "#B9F2FF", "label": "100K Likes",     "icon": "heart", "shine": True},
    "likes_1000000": {"type": "likes",  "tier": "gradient", "threshold": 1000000,  "color": "linear-gradient(135deg, #87CEEB, #9B59B6)", "label": "1M Likes", "icon": "heart", "shine": True},
    "followers_50":    {"type": "followers", "tier": "bronze",   "threshold": 50,     "color": "#8B6914", "label": "50 Followers",   "icon": "users"},
    "followers_500":   {"type": "followers", "tier": "silver",   "threshold": 500,    "color": "#A8A8A8", "label": "500 Followers",  "icon": "users"},
    "followers_1000":  {"type": "followers", "tier": "gold",     "threshold": 1000,   "color": "#DAA520", "label": "1K Followers",   "icon": "users"},
    "followers_5000":  {"type": "followers", "tier": "diamond",  "threshold": 5000,   "color": "#B9F2FF", "label": "5K Followers",   "icon": "users", "shine": True},
    "followers_10000": {"type": "followers", "tier": "gradient", "threshold": 10000,  "color": "linear-gradient(135deg, #87CEEB, #9B59B6)", "label": "10K Followers", "icon": "users", "shine": True},
    "age_30":    {"type": "age", "tier": "bronze",  "threshold": 30,    "color": "#8B6914", "label": "1 Month",        "icon": "clock"},
    "age_180":   {"type": "age", "tier": "silver",  "threshold": 180,   "color": "#A8A8A8", "label": "6 Months",       "icon": "clock"},
    "age_365":   {"type": "age", "tier": "gold",    "threshold": 365,   "color": "#DAA520", "label": "1 Year",         "icon": "clock"},
    "age_1095":  {"type": "age", "tier": "diamond", "threshold": 1095,  "color": "#B9F2FF", "label": "3 Years",        "icon": "clock", "shine": True},
    "age_2190":  {"type": "age", "tier": "gradient", "threshold": 2190, "color": "linear-gradient(135deg, #87CEEB, #9B59B6)", "label": "6+ Years", "icon": "clock", "shine": True},
    "streak_3":   {"type": "streak", "tier": "bronze",   "threshold": 3,    "color": "#8B6914", "label": "3-Day Streak",   "icon": "flame"},
    "streak_7":   {"type": "streak", "tier": "silver",   "threshold": 7,    "color": "#A8A8A8", "label": "7-Day Streak",   "icon": "flame"},
    "streak_14":  {"type": "streak", "tier": "gold",     "threshold": 14,   "color": "#DAA520", "label": "14-Day Streak",  "icon": "flame"},
    "streak_30":  {"type": "streak", "tier": "diamond",  "threshold": 30,   "color": "#B9F2FF", "label": "30-Day Streak",  "icon": "flame", "shine": True},
    "streak_100": {"type": "streak", "tier": "gradient", "threshold": 100,  "color": "linear-gradient(135deg, #FF6B35, #FFD700)", "label": "100-Day Streak", "icon": "flame", "shine": True},
    "bug_catcher": {"type": "other", "tier": "gold", "threshold": 2, "color": "#22C55E", "label": "Bug Catcher", "icon": "bug", "anim": "bug-legs"},
}


async def check_and_award_diary_achievements(user_id: str) -> list[dict]:
    from app.repositories.diary_repo import DiaryRepository
    count = await DiaryRepository().count_user_diaries(user_id, "public")
    awarded = await _award("diaries", count, user_id)
    streak = await _compute_streak(user_id)
    awarded += await _award("streak", streak, user_id)
    return awarded


async def check_and_award_likes_achievements(user_id: str) -> list[dict]:
    from app.repositories.diary_repo import DiaryRepository
    diaries = await DiaryRepository().find_user_diaries(user_id, limit=2000)
    total_likes = sum(d.get("stats", {}).get("like_count", 0) for d in diaries)
    return await _award("likes", total_likes, user_id)


async def check_and_award_followers_achievements(user_id: str) -> list[dict]:
    user = await UserRepository().get_by_id(user_id)
    if not user:
        return []
    count = user.get("stats", {}).get("follower_count", 0)
    return await _award("followers", count, user_id)


async def check_and_award_age_achievements(user_id: str) -> list[dict]:
    user = await UserRepository().get_by_id(user_id)
    if not user or not user.get("created_at"):
        return []
    days = (datetime.now(UTC) - user["created_at"].replace(tzinfo=UTC)).days
    return await _award("age", days, user_id)


async def _compute_streak(user_id: str) -> int:
    from app.repositories.diary_repo import DiaryRepository
    diaries = await DiaryRepository().find_user_diaries(user_id, sort=[("created_at", -1)], limit=200)
    if not diaries:
        return 0
    today = datetime.now(UTC).date()
    streak = 0
    expected = today
    seen = set()
    for d in diaries:
        d_date = d.get("created_at")
        if not d_date:
            continue
        day = d_date.replace(tzinfo=UTC).date() if hasattr(d_date, "replace") else d_date.date()
        if day > today:
            continue
        if day == expected:
            streak += 1
            expected = day - timedelta(days=1)
            seen.add(day)
        elif day < expected and day not in seen:
            break
    return streak


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
                "anim": ach.get("anim"),
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
            "anim": d.get("anim"),
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
        "anim": badge.get("anim"),
    }


async def get_displayed_badges(user_id: str) -> list[dict]:
    user_repo = UserRepository()
    user = await user_repo.get_by_id(user_id)
    if not user or not user.get("displayed_badges"):
        return []
    return [
        {
            "type": b.get("type", ""),
            "tier": b.get("tier", "bronze"),
            "label": b.get("label", ""),
            "color": b.get("color", "#8B6914"),
            "icon": b.get("icon", "book"),
            "shine": b.get("shine", False),
            "anim": b.get("anim"),
        }
        for b in user["displayed_badges"].values()
    ]


async def set_displayed_badge(user_id: str, achievement_id: str) -> dict | None:
    from app.core.database import DatabaseManager
    db = DatabaseManager.get_db()
    ach = await db.achievements.find_one({"_id": ObjectId(achievement_id), "user_id": ObjectId(user_id)})
    if not ach:
        return None
    badge_data = {
        "type": ach["type"],
        "tier": ach["tier"],
        "threshold": ach["threshold"],
        "label": ach["label"],
        "color": ach["color"],
        "icon": ach.get("icon", "book"),
        "shine": ach.get("shine", False),
        "anim": ach.get("anim"),
    }
    user_repo = UserRepository()
    user = await user_repo.get_by_id(user_id)
    badges = (user.get("displayed_badges") or {}).copy() if user else {}
    badges[ach["type"]] = badge_data
    await user_repo.update(user_id, {"displayed_badges": badges})
    return badge_data


async def clear_displayed_badge(user_id: str, badge_type: str | None = None) -> None:
    user_repo = UserRepository()
    if badge_type:
        user = await user_repo.get_by_id(user_id)
        if user and user.get("displayed_badges"):
            badges = user["displayed_badges"].copy()
            badges.pop(badge_type, None)
            await user_repo.update(user_id, {"displayed_badges": badges})
    else:
        await user_repo.update(user_id, {"displayed_badges": {}})
