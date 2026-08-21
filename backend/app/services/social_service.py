import asyncio
import time
from datetime import UTC, datetime

from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.repositories.bookmark_repo import BookmarkRepository
from app.repositories.diary_repo import DiaryRepository
from app.repositories.follow_repo import FollowRepository
from app.repositories.like_repo import LikeRepository
from app.repositories.user_repo import UserRepository


class _ToggleLocks:
    """Per-(user, target) asyncio locks that serialize toggle operations within
    this process.

    A toggle is a delete-then-insert flip. Under concurrent requests the
    ordering of delete/insert across requests is nondeterministic, so two
    simultaneous "like" calls could end unliked. Serializing each (actor,
    target) pair makes concurrent toggles behave like a deterministic sequence
    (two likes -> liked; two unlikes -> unliked). This matches the single-
    backend production architecture (see MED-7); a multi-replica deployment
    would additionally rely on the DB unique indexes already in place.

    Locks are evicted after ``_LOCK_TTL`` seconds of inactivity to prevent
    unbounded memory growth.
    """

    _LOCK_TTL = 300  # 5 minutes

    def __init__(self):
        self._locks: dict[tuple, tuple[asyncio.Lock, float]] = {}
        self._guard = asyncio.Lock()

    async def get(self, key: tuple) -> asyncio.Lock:
        async with self._guard:
            now = time.monotonic()
            # Evict stale entries while holding the guard.
            stale = [k for k, (_, ts) in self._locks.items() if now - ts > self._LOCK_TTL]
            for k in stale:
                del self._locks[k]
            lock, _ = self._locks.get(key, (asyncio.Lock(), now))
            self._locks[key] = (lock, now)
            return lock


_toggle_locks = _ToggleLocks()


async def _toggle_guard(key: tuple):
    return await _toggle_locks.get(key)


async def _count_liked_public_diaries(collection, user_id: str, banned_ids: list) -> int:
    """Count a user's liked/bookmarked diaries that are public and not authored
    by a banned user, using a DB-side aggregation instead of materializing all
    like/bookmark rows into memory."""
    from bson import ObjectId

    pipeline: list[dict] = [
        {"$match": {"user_id": ObjectId(user_id)}},
        {
            "$lookup": {
                "from": "diaries",
                "localField": "diary_id",
                "foreignField": "_id",
                "as": "diary",
            }
        },
        {"$unwind": "$diary"},
        {"$match": {"diary.privacy": "public"}},
    ]
    if banned_ids:
        pipeline.append({"$match": {"diary.user_id": {"$nin": banned_ids}}})
    pipeline.append({"$count": "total"})
    result = await collection.aggregate(pipeline).to_list(length=1)
    return result[0]["total"] if result else 0


async def _sync_comment_counts(diaries: list[dict]) -> None:
    if not diaries:
        return
    diary_ids = [d["_id"] for d in diaries]
    repo = DiaryRepository()
    counts = await repo._collection.database.comments.aggregate(
        [
            {
                "$match": {
                    "diary_id": {"$in": diary_ids},
                    "is_deleted": {"$ne": True},
                    "parent_comment_id": None,
                }
            },
            {"$group": {"_id": "$diary_id", "count": {"$sum": 1}}},
        ]
    ).to_list(length=len(diary_ids))
    count_map = {str(c["_id"]): c["count"] for c in counts}
    for d in diaries:
        d["stats"]["comment_count"] = count_map.get(str(d["_id"]), 0)


async def toggle_like(diary_id: str, current_user: dict) -> dict:
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    if diary.get("privacy") != "public":
        raise NotFoundException("Diary not found")

    if current_user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    like_repo = LikeRepository()
    user_id = str(current_user["_id"])

    async with await _toggle_guard(("like", user_id, diary_id)):
        # Atomic toggle: delete first; if a like was actually removed the state
        # flipped to unliked. Otherwise insert (upsert with $setOnInsert); the
        # unique index + upserted_id guarantees a single like and a single
        # counter increment even under concurrent requests.
        removed = await like_repo.ensure_unliked(user_id, diary_id)
        if removed:
            await diary_repo._collection.update_one(
                {"_id": diary["_id"]}, {"$inc": {"stats.like_count": -1}}
            )
            diary = await diary_repo.get_by_id(diary_id)
            if diary:
                from app.services.diary_service import _index_diary_async

                _index_diary_async(diary)
            return {
                "is_liked": False,
                "like_count": diary["stats"]["like_count"] if diary else 0,
            }

        added = await like_repo.ensure_liked(user_id, diary_id, datetime.now(UTC))
        if added:
            await diary_repo._collection.update_one(
                {"_id": diary["_id"]}, {"$inc": {"stats.like_count": 1}}
            )
        diary = await diary_repo.get_by_id(diary_id)
        if diary and added:
            from app.services.diary_service import _index_diary_async

            _index_diary_async(diary)
            from app.services.notification_service import _send_notification_async

            _send_notification_async(
                recipient_id=str(diary["user_id"]),
                actor_id=user_id,
                notification_type="like",
                target_id=diary_id,
                metadata={"diary_title": diary.get("title")},
            )
            _check_likes_achievement_async(str(diary["user_id"]))
        return {
            "is_liked": True,
            "like_count": diary["stats"]["like_count"] if diary else 0,
        }


async def toggle_bookmark(diary_id: str, current_user: dict) -> dict:
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    if diary.get("privacy") != "public":
        raise NotFoundException("Diary not found")

    if current_user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    bookmark_repo = BookmarkRepository()
    user_id = str(current_user["_id"])

    async with await _toggle_guard(("bookmark", user_id, diary_id)):
        removed = await bookmark_repo.ensure_unbookmarked(user_id, diary_id)
        if removed:
            await diary_repo._collection.update_one(
                {"_id": diary["_id"]}, {"$inc": {"stats.bookmark_count": -1}}
            )
            diary = await diary_repo.get_by_id(diary_id)
            if diary:
                from app.services.diary_service import _index_diary_async

                _index_diary_async(diary)
            return {
                "is_bookmarked": False,
                "bookmark_count": diary["stats"]["bookmark_count"] if diary else 0,
            }

        added = await bookmark_repo.ensure_bookmarked(user_id, diary_id, datetime.now(UTC))
        if added:
            await diary_repo._collection.update_one(
                {"_id": diary["_id"]}, {"$inc": {"stats.bookmark_count": 1}}
            )
        diary = await diary_repo.get_by_id(diary_id)
        if diary and added:
            from app.services.diary_service import _index_diary_async

            _index_diary_async(diary)
            from app.services.notification_service import _send_notification_async

            _send_notification_async(
                recipient_id=str(diary["user_id"]),
                actor_id=user_id,
                notification_type="bookmark",
                target_id=diary_id,
                metadata={"diary_title": diary.get("title")},
            )
        return {
            "is_bookmarked": True,
            "bookmark_count": diary["stats"]["bookmark_count"] if diary else 0,
        }


async def toggle_follow(username: str, current_user: dict) -> dict:
    user_repo = UserRepository()
    target = await user_repo.get_by_username(username)
    if target is None:
        raise NotFoundException("User not found")

    if target.get("is_banned"):
        raise PermissionDeniedException("This account has been suspended")

    if str(target["_id"]) == str(current_user["_id"]):
        raise ValidationException("You cannot follow yourself")

    if current_user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    follow_repo = FollowRepository()
    follower_id = str(current_user["_id"])
    following_id = str(target["_id"])

    async with await _toggle_guard(("follow", follower_id, following_id)):
        removed = await follow_repo.ensure_unfollowed(follower_id, following_id)
        if removed:
            await user_repo.update_stats(following_id, "follower_count", -1)
            await user_repo.update_stats(follower_id, "following_count", -1)
            target = await user_repo.get_by_id(following_id)
            return {
                "is_following": False,
                "follower_count": target["stats"]["follower_count"] if target else 0,
            }

        added = await follow_repo.ensure_following(
            follower_id, following_id, datetime.now(UTC)
        )
        if added:
            await user_repo.update_stats(following_id, "follower_count", 1)
            await user_repo.update_stats(follower_id, "following_count", 1)
        target = await user_repo.get_by_id(following_id)
        if added:
            from app.services.notification_service import _send_notification_async

            _send_notification_async(
                recipient_id=following_id,
                actor_id=follower_id,
                notification_type="follow",
                target_id=following_id,
                target_type="user",
            )
            _check_followers_achievement_async(following_id)
        return {
            "is_following": True,
            "follower_count": target["stats"]["follower_count"] if target else 0,
        }


async def list_followers(
    username: str,
    page: int = 1,
    per_page: int = 20,
    current_user: dict | None = None,
) -> dict:
    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)
    if user is None:
        raise NotFoundException("User not found")

    follow_repo = FollowRepository()
    skip = (page - 1) * per_page
    follows = await follow_repo.find_followers(str(user["_id"]), skip=skip, limit=per_page)
    total = await follow_repo.count_followers(str(user["_id"]))

    follower_ids = [str(f["follower_id"]) for f in follows]
    users = await user_repo.find_by_ids(follower_ids)
    followers_map = {str(u["_id"]): u for u in users}

    following_set: set[str] = set()
    if current_user and follower_ids:
        following_set = await follow_repo.find_following_by_ids(
            str(current_user["_id"]), follower_ids
        )

    data = []
    for f in follows:
        fid = str(f["follower_id"])
        u = followers_map.get(fid, {"_id": fid, "username": "unknown"})
        if u.get("is_banned"):
            continue
        data.append(
            {
                "id": str(u.get("_id", fid)),
                "username": u.get("username", "unknown"),
                "avatar_path": u.get("avatar_path"),
                "about": u.get("about"),
                "is_following": fid in following_set,
            }
        )

    return {
        "data": data,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": (page * per_page) < total,
            "has_prev": page > 1,
        },
    }


async def list_following(
    username: str,
    page: int = 1,
    per_page: int = 20,
    current_user: dict | None = None,
) -> dict:
    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)
    if user is None:
        raise NotFoundException("User not found")

    follow_repo = FollowRepository()
    skip = (page - 1) * per_page
    follows = await follow_repo.find_following(str(user["_id"]), skip=skip, limit=per_page)
    total = await follow_repo.count_following(str(user["_id"]))

    following_ids = [str(f["following_id"]) for f in follows]
    users = await user_repo.find_by_ids(following_ids)
    following_map = {str(u["_id"]): u for u in users}

    following_set: set[str] = set()
    if current_user and following_ids:
        following_set = await follow_repo.find_following_by_ids(
            str(current_user["_id"]), following_ids
        )

    data = []
    for f in follows:
        fid = str(f["following_id"])
        u = following_map.get(fid, {"_id": fid, "username": "unknown"})
        if u.get("is_banned"):
            continue
        data.append(
            {
                "id": str(u.get("_id", fid)),
                "username": u.get("username", "unknown"),
                "avatar_path": u.get("avatar_path"),
                "about": u.get("about"),
                "is_following": fid in following_set,
            }
        )

    return {
        "data": data,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": (page * per_page) < total,
            "has_prev": page > 1,
        },
    }


async def list_my_likes(
    current_user: dict,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    like_repo = LikeRepository()
    skip = (page - 1) * per_page
    likes = await like_repo.find_by_user(str(current_user["_id"]), skip=skip, limit=per_page)

    diary_ids = [str(like["diary_id"]) for like in likes]
    diary_repo = DiaryRepository()
    user_repo = UserRepository()

    banned_ids = await user_repo.get_banned_user_ids()

    diaries = await diary_repo.find_by_ids(diary_ids)
    if banned_ids:
        diaries = [
            d for d in diaries if d.get("privacy") == "public" and d["user_id"] not in banned_ids
        ]
    else:
        diaries = [d for d in diaries if d.get("privacy") == "public"]

    total = await _count_liked_public_diaries(
        like_repo._collection, str(current_user["_id"]), banned_ids
    )

    if not diaries:
        return {
            "data": [],
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_next": (page * per_page) < total,
                "has_prev": page > 1,
            },
        }

    author_ids = list({str(d["user_id"]) for d in diaries})
    authors = await user_repo.find_by_ids(author_ids)
    author_map = {str(u["_id"]): u for u in authors}

    await _sync_comment_counts(diaries)
    from app.services.enrichment_service import enrich_diary_batch

    diaries = await enrich_diary_batch(diaries, current_user)

    data = []
    for diary in diaries:
        author = author_map.get(
            str(diary["user_id"]), {"_id": str(diary["user_id"]), "username": "unknown"}
        )
        from app.services.diary_service import _build_diary_list_item

        item = _build_diary_list_item(diary, author, current_user)
        data.append(item)

    return {
        "data": data,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": (page * per_page) < total,
            "has_prev": page > 1,
        },
    }


async def list_my_bookmarks(
    current_user: dict,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    bookmark_repo = BookmarkRepository()
    skip = (page - 1) * per_page
    bookmarks = await bookmark_repo.find_by_user(
        str(current_user["_id"]), skip=skip, limit=per_page
    )

    diary_ids = [str(bm["diary_id"]) for bm in bookmarks]
    diary_repo = DiaryRepository()
    user_repo = UserRepository()

    banned_ids = await user_repo.get_banned_user_ids()

    total = await _count_liked_public_diaries(
        bookmark_repo._collection, str(current_user["_id"]), banned_ids
    )

    diaries = await diary_repo.find_by_ids(diary_ids)
    if banned_ids:
        diaries = [
            d for d in diaries if d.get("privacy") == "public" and d["user_id"] not in banned_ids
        ]
    else:
        diaries = [d for d in diaries if d.get("privacy") == "public"]

    if not diaries:
        return {
            "data": [],
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_next": (page * per_page) < total,
                "has_prev": page > 1,
            },
        }

    author_ids = list({str(d["user_id"]) for d in diaries})
    authors = await user_repo.find_by_ids(author_ids)
    author_map = {str(u["_id"]): u for u in authors}

    await _sync_comment_counts(diaries)
    from app.services.enrichment_service import enrich_diary_batch

    diaries = await enrich_diary_batch(diaries, current_user)

    data = []
    for diary in diaries:
        author = author_map.get(
            str(diary["user_id"]), {"_id": str(diary["user_id"]), "username": "unknown"}
        )
        from app.services.diary_service import _build_diary_list_item

        item = _build_diary_list_item(diary, author, current_user)
        data.append(item)

    return {
        "data": data,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": (page * per_page) < total,
            "has_prev": page > 1,
        },
    }


async def list_following_feed(
    current_user: dict,
    limit: int = 6,
) -> dict:
    follow_repo = FollowRepository()
    following_ids = await follow_repo.get_following_ids(str(current_user["_id"]), limit=200)
    if not following_ids:
        return {"data": [], "meta": {"total": 0, "limit": limit}}

    diary_repo = DiaryRepository()
    user_repo = UserRepository()
    banned_ids = await user_repo.get_banned_user_ids()
    diaries = await diary_repo.find_public_by_user_ids(
        following_ids,
        sort=[("published_at", -1)],
        limit=limit,
        exclude_user_ids=banned_ids if banned_ids else None,
    )

    if not diaries:
        return {"data": [], "meta": {"total": 0, "limit": limit}}

    from app.services.enrichment_service import enrich_diary_batch

    diaries = await enrich_diary_batch(diaries, current_user)

    await _sync_comment_counts(diaries)

    user_repo = UserRepository()
    author_ids = list({str(d["user_id"]) for d in diaries})
    authors = await user_repo.find_by_ids(author_ids)
    author_map = {str(u["_id"]): u for u in authors}

    from app.services.diary_service import _build_diary_list_item

    data = []
    for diary in diaries:
        author = author_map.get(
            str(diary["user_id"]), {"_id": str(diary["user_id"]), "username": "unknown"}
        )
        data.append(_build_diary_list_item(diary, author, current_user))

    return {"data": data, "meta": {"total": len(data), "limit": limit}}


def _check_likes_achievement_async(user_id: str) -> None:
    from app.core.background import run_in_background

    async def _do():
        try:
            from app.services.achievement_service import check_and_award_likes_achievements

            await check_and_award_likes_achievements(user_id)
        except Exception:
            pass

    run_in_background(_do())


def _check_followers_achievement_async(user_id: str) -> None:
    from app.core.background import run_in_background

    async def _do():
        try:
            from app.services.achievement_service import check_and_award_followers_achievements

            await check_and_award_followers_achievements(user_id)
        except Exception:
            pass

    run_in_background(_do())
