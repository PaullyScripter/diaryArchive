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


async def _sync_comment_counts(diaries: list[dict]) -> None:
    if not diaries:
        return
    from bson import ObjectId
    diary_ids = [d["_id"] for d in diaries]
    repo = DiaryRepository()
    counts = await repo._collection.database.comments.aggregate([
        {"$match": {
            "diary_id": {"$in": diary_ids},
            "is_deleted": {"$ne": True},
            "parent_comment_id": None,
        }},
        {"$group": {"_id": "$diary_id", "count": {"$sum": 1}}},
    ]).to_list(length=len(diary_ids))
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

    deleted = await like_repo.find_one_and_delete(user_id, diary_id)
    if deleted is not None:
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

    try:
        await like_repo.create({
            "user_id": current_user["_id"],
            "diary_id": diary["_id"],
            "created_at": datetime.now(UTC),
        })
    except Exception:
        diary = await diary_repo.get_by_id(diary_id)
        return {
            "is_liked": False,
            "like_count": diary["stats"]["like_count"] if diary else 0,
        }
    await diary_repo._collection.update_one(
        {"_id": diary["_id"]}, {"$inc": {"stats.like_count": 1}}
    )
    diary = await diary_repo.get_by_id(diary_id)
    if diary:
        from app.services.diary_service import _index_diary_async
        _index_diary_async(diary)
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

    deleted = await bookmark_repo.find_one_and_delete(user_id, diary_id)
    if deleted is not None:
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

    try:
        await bookmark_repo.create({
            "user_id": current_user["_id"],
            "diary_id": diary["_id"],
            "created_at": datetime.now(UTC),
        })
    except Exception:
        diary = await diary_repo.get_by_id(diary_id)
        return {
            "is_bookmarked": False,
            "bookmark_count": diary["stats"]["bookmark_count"] if diary else 0,
        }
    await diary_repo._collection.update_one(
        {"_id": diary["_id"]}, {"$inc": {"stats.bookmark_count": 1}}
    )
    diary = await diary_repo.get_by_id(diary_id)
    if diary:
        from app.services.diary_service import _index_diary_async
        _index_diary_async(diary)
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

    deleted = await follow_repo.find_one_and_delete(follower_id, following_id)
    if deleted is not None:
        await user_repo.update_stats(following_id, "follower_count", -1)
        await user_repo.update_stats(follower_id, "following_count", -1)
        target = await user_repo.get_by_id(following_id)
        return {
            "is_following": False,
            "follower_count": target["stats"]["follower_count"] if target else 0,
        }

    try:
        await follow_repo.create({
            "follower_id": current_user["_id"],
            "following_id": target["_id"],
            "created_at": datetime.now(UTC),
        })
    except Exception:
        target = await user_repo.get_by_id(following_id)
        return {
            "is_following": False,
            "follower_count": target["stats"]["follower_count"] if target else 0,
        }
    await user_repo.update_stats(following_id, "follower_count", 1)
    await user_repo.update_stats(follower_id, "following_count", 1)
    target = await user_repo.get_by_id(following_id)
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
        following_set = await follow_repo.find_following_by_ids(str(current_user["_id"]), follower_ids)

    data = []
    for f in follows:
        fid = str(f["follower_id"])
        u = followers_map.get(fid, {"_id": fid, "username": "unknown"})
        data.append({
            "id": str(u.get("_id", fid)),
            "username": u.get("username", "unknown"),
            "avatar_path": u.get("avatar_path"),
            "about": u.get("about"),
            "is_following": fid in following_set,
        })

    return {
        "data": data,
        "meta": {
            "page": page, "per_page": per_page, "total": total,
            "has_next": (page * per_page) < total, "has_prev": page > 1,
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
        following_set = await follow_repo.find_following_by_ids(str(current_user["_id"]), following_ids)

    data = []
    for f in follows:
        fid = str(f["following_id"])
        u = following_map.get(fid, {"_id": fid, "username": "unknown"})
        data.append({
            "id": str(u.get("_id", fid)),
            "username": u.get("username", "unknown"),
            "avatar_path": u.get("avatar_path"),
            "about": u.get("about"),
            "is_following": fid in following_set,
        })

    return {
        "data": data,
        "meta": {
            "page": page, "per_page": per_page, "total": total,
            "has_next": (page * per_page) < total, "has_prev": page > 1,
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
    total = await like_repo.count_by_user(str(current_user["_id"]))

    diary_ids = [str(like["diary_id"]) for like in likes]
    diary_repo = DiaryRepository()
    user_repo = UserRepository()

    diaries = await diary_repo.find_by_ids(diary_ids)
    diaries = [d for d in diaries if d.get("privacy") == "public"]

    if not diaries:
        return {
            "data": [],
            "meta": {
                "page": page, "per_page": per_page, "total": total,
                "has_next": (page * per_page) < total, "has_prev": page > 1,
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
        author = author_map.get(str(diary["user_id"]), {"_id": str(diary["user_id"]), "username": "unknown"})
        from app.services.diary_service import _build_diary_list_item
        item = _build_diary_list_item(diary, author, current_user)
        data.append(item)

    return {
        "data": data,
        "meta": {
            "page": page, "per_page": per_page, "total": total,
            "has_next": (page * per_page) < total, "has_prev": page > 1,
        },
    }


async def list_my_bookmarks(
    current_user: dict,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    bookmark_repo = BookmarkRepository()
    skip = (page - 1) * per_page
    bookmarks = await bookmark_repo.find_by_user(str(current_user["_id"]), skip=skip, limit=per_page)
    total = await bookmark_repo.count_by_user(str(current_user["_id"]))

    diary_ids = [str(bm["diary_id"]) for bm in bookmarks]
    diary_repo = DiaryRepository()
    user_repo = UserRepository()

    diaries = await diary_repo.find_by_ids(diary_ids)
    diaries = [d for d in diaries if d.get("privacy") == "public"]

    if not diaries:
        return {
            "data": [],
            "meta": {
                "page": page, "per_page": per_page, "total": total,
                "has_next": (page * per_page) < total, "has_prev": page > 1,
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
        author = author_map.get(str(diary["user_id"]), {"_id": str(diary["user_id"]), "username": "unknown"})
        from app.services.diary_service import _build_diary_list_item
        item = _build_diary_list_item(diary, author, current_user)
        data.append(item)

    return {
        "data": data,
        "meta": {
            "page": page, "per_page": per_page, "total": total,
            "has_next": (page * per_page) < total, "has_prev": page > 1,
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
    diaries = await diary_repo.find_public_by_user_ids(
        following_ids,
        sort=[("published_at", -1)],
        limit=limit,
    )

    if not diaries:
        return {"data": [], "meta": {"total": 0, "limit": limit}}

    from app.services.enrichment_service import enrich_diary_batch
    diaries = await enrich_diary_batch(diaries, current_user)

    user_repo = UserRepository()
    author_ids = list({str(d["user_id"]) for d in diaries})
    authors = await user_repo.find_by_ids(author_ids)
    author_map = {str(u["_id"]): u for u in authors}

    from app.services.diary_service import _build_diary_list_item
    data = []
    for diary in diaries:
        author = author_map.get(str(diary["user_id"]), {"_id": str(diary["user_id"]), "username": "unknown"})
        data.append(_build_diary_list_item(diary, author, current_user))

    return {"data": data, "meta": {"total": len(data), "limit": limit}}
