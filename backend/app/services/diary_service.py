import logging
from datetime import UTC, datetime

from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.core.sanitize import sanitize_html
from app.core.utils import fmt_dt
from app.repositories.diary_repo import DiaryRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


def _index_diary_async(diary: dict) -> None:
    async def _do_index():
        try:
            from app.search.indexer import DiaryIndexer
            indexer = DiaryIndexer()
            await indexer.index_diary(diary)
        except Exception:
            logger.warning("Async indexing failed for diary %s", diary.get("_id"))
    import asyncio
    asyncio.create_task(_do_index())


def _remove_from_index_async(diary_id: str) -> None:
    async def _do_remove():
        try:
            from app.search.indexer import DiaryIndexer
            indexer = DiaryIndexer()
            await indexer.remove_diary(diary_id)
        except Exception:
            logger.warning("Async index removal failed for diary %s", diary_id)
    import asyncio
    asyncio.create_task(_do_remove())


VALID_WARNINGS = frozenset({"adult", "violence", "self-harm", "substance"})


def _build_author(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "avatar_path": user.get("avatar_path"),
    }


def _build_diary_response(diary: dict, author: dict, current_user: dict | None = None) -> dict:
    is_owner = False
    is_liked = False
    is_bookmarked = False
    if current_user:
        is_owner = str(diary["user_id"]) == str(current_user["_id"])
    result = {
        "id": str(diary["_id"]),
        "privacy": diary.get("privacy", "public"),
        "title": diary.get("title"),
        "content_html": diary.get("content_html"),
        "content_text": diary.get("content_text"),
        "author": _build_author(author),
        "tags": diary.get("tags", []),
        "emotion": diary.get("emotion"),
        "comments_enabled": diary.get("comments_enabled", True),
        "comments_locked": diary.get("comments_locked", False),
        "stats": diary.get("stats", {"like_count": 0, "comment_count": 0, "bookmark_count": 0}),
        "is_liked": is_liked,
        "is_bookmarked": is_bookmarked,
        "is_owner": is_owner,
        "content_warnings": diary.get("content_warnings", []),
        "created_at": fmt_dt(diary.get("created_at")),
        "updated_at": fmt_dt(diary.get("updated_at")),
        "published_at": fmt_dt(diary.get("published_at")),
    }
    if diary.get("privacy") == "private" and is_owner:
        ed = diary.get("encrypted_data")
        result["encrypted_data"] = ed if ed else None
    return result


def _build_diary_list_item(diary: dict, author: dict, current_user: dict | None = None) -> dict:
    content_text = diary.get("content_text") or ""
    is_owner = current_user and str(diary["user_id"]) == str(current_user["_id"])
    result = {
        "id": str(diary["_id"]),
        "privacy": diary.get("privacy", "public"),
        "title": diary.get("title"),
        "excerpt": content_text[:200] if content_text else None,
        "author": _build_author(author),
        "tags": diary.get("tags", []),
        "emotion": diary.get("emotion"),
        "stats": diary.get("stats", {"like_count": 0, "comment_count": 0, "bookmark_count": 0}),
        "is_liked": diary.get("is_liked", False),
        "is_bookmarked": diary.get("is_bookmarked", False),
        "content_warnings": diary.get("content_warnings", []),
        "created_at": fmt_dt(diary.get("created_at")),
        "updated_at": fmt_dt(diary.get("updated_at")),
        "published_at": fmt_dt(diary.get("published_at")),
    }
    if diary.get("privacy") == "private" and is_owner:
        ed = diary.get("encrypted_data")
        result["encrypted_data"] = ed if ed else None
    return result


def _validate_tags(tags: list[str]) -> list[str]:
    cleaned = []
    for tag in tags:
        tag = tag.lower().strip()
        if not tag:
            continue
        if len(tag) > 50:
            raise ValidationException(f"Tag '{tag}' exceeds 50 characters")
        if not all(c.isalnum() or c == "-" for c in tag):
            raise ValidationException(
                f"Tag '{tag}' contains invalid characters (use a-z, 0-9, hyphens)"
            )
        cleaned.append(tag)
    if len(cleaned) > 50:
        raise ValidationException("Maximum 50 tags allowed")
    return cleaned


def _validate_emotion(emotion: str | None) -> str | None:
    if emotion is None:
        return None
    emotion = emotion.strip()
    if len(emotion) > 50:
        raise ValidationException("Emotion exceeds 50 characters")
    return emotion


async def create_diary(user: dict, data: dict) -> dict:
    user_repo = UserRepository()
    diary_repo = DiaryRepository()

    if user.get("is_banned"):
        raise PermissionDeniedException("Your account has been banned")

    privacy = data.get("privacy", "public")
    if privacy not in ("public", "draft", "private"):
        raise ValidationException("Privacy must be 'public', 'draft', or 'private'")

    if privacy == "private":
        encrypted_data = data.get("encrypted_data")
        if not encrypted_data:
            raise ValidationException("encrypted_data is required for private diaries")
        if not isinstance(encrypted_data, dict):
            raise ValidationException("encrypted_data must be an object")
        if not all(k in encrypted_data for k in ("ciphertext", "iv", "salt")):
            raise ValidationException(
                "encrypted_data must contain ciphertext, iv, and salt"
            )
        if data.get("content_html"):
            raise ValidationException("content_html must be absent for private diaries")
        if data.get("content_text"):
            raise ValidationException("content_text must be absent for private diaries")
        if data.get("title"):
            raise ValidationException("title must be absent for private diaries")

    title = data.get("title")
    if privacy != "private" and privacy != "draft" and not title:
        raise ValidationException("Title is required for public diaries")

    content_html = data.get("content_html")
    if content_html and privacy != "private":
        content_html = sanitize_html(content_html)
        if len(content_html.encode("utf-8")) > 102400:
            raise ValidationException("Content exceeds 100KB limit after sanitization")

    content_text = data.get("content_text", "")
    if privacy != "private" and len(content_text.encode("utf-8")) > 51200:
        raise ValidationException("Content text exceeds 50KB limit")

    tags = _validate_tags(data.get("tags", []))
    emotion = _validate_emotion(data.get("emotion"))

    content_warnings = data.get("content_warnings", [])
    if not isinstance(content_warnings, list):
        content_warnings = []
    content_warnings = [w.lower().strip() for w in content_warnings if w.lower().strip() in VALID_WARNINGS]

    now = datetime.now(UTC)
    if privacy == "private":
        diary_doc = {
            "user_id": user["_id"],
            "privacy": privacy,
            "title": None,
            "content_html": None,
            "content_text": None,
            "encrypted_data": data["encrypted_data"],
            "tags": tags,
            "emotion": emotion,
            "content_warnings": [],
            "comments_enabled": False,
            "comments_locked": False,
            "stats": {"like_count": 0, "comment_count": 0, "bookmark_count": 0},
            "year": now.year,
            "month": now.month,
            "created_at": now,
            "updated_at": now,
            "published_at": None,
        }
    else:
        diary_doc = {
            "user_id": user["_id"],
            "privacy": privacy,
            "title": title,
            "content_html": content_html,
            "content_text": content_text,
            "tags": tags,
            "emotion": emotion,
            "content_warnings": content_warnings,
            "comments_enabled": data.get("comments_enabled", True),
            "comments_locked": False,
            "stats": {"like_count": 0, "comment_count": 0, "bookmark_count": 0},
            "year": now.year,
            "month": now.month,
            "created_at": now,
            "updated_at": now,
            "published_at": now if privacy == "public" else None,
        }

    diary_id = await diary_repo.create(diary_doc)
    await user_repo.update_stats(str(user["_id"]), "diary_count", 1)

    if privacy == "public":
        diary_doc["_id"] = diary_id
        _index_diary_async(diary_doc)

    return {
        "id": str(diary_id),
        "created_at": fmt_dt(now),
        "message": "Diary created successfully.",
    }


async def get_diary(diary_id: str, current_user: dict | None = None) -> dict:
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    is_owner = current_user and str(diary["user_id"]) == str(current_user["_id"])

    if diary.get("privacy") in ("private", "draft") and not is_owner:
        raise NotFoundException("Diary not found")

    user_repo = UserRepository()
    author = await user_repo.get_by_id(str(diary["user_id"]))
    if author is None:
        raise NotFoundException("Author not found")

    is_liked = False
    is_bookmarked = False
    if current_user and diary.get("privacy") == "public":
        from app.repositories.like_repo import LikeRepository
        from app.repositories.bookmark_repo import BookmarkRepository
        user_id = str(current_user["_id"])
        like = await LikeRepository().find_by_user_and_diary(user_id, diary_id)
        bookmark = await BookmarkRepository().find_by_user_and_diary(user_id, diary_id)
        is_liked = like is not None
        is_bookmarked = bookmark is not None

    result = _build_diary_response(diary, author, current_user)
    result["is_liked"] = is_liked
    result["is_bookmarked"] = is_bookmarked
    return result


async def update_diary(diary_id: str, updates: dict, current_user: dict) -> dict:
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    if str(diary["user_id"]) != str(current_user["_id"]):
        raise PermissionDeniedException("You do not own this diary")

    set_fields = {}
    current_privacy = diary.get("privacy", "public")

    if "privacy" in updates and updates["privacy"] is not None:
        new_privacy = updates["privacy"]
        if new_privacy not in ("public", "draft", "private"):
            raise ValidationException("Privacy must be 'public', 'draft', or 'private'")
        if current_privacy == "private" and new_privacy != "private":
            raise ValidationException("Cannot change privacy from private")
        if current_privacy != "private" and new_privacy == "private":
            raise ValidationException("Cannot change privacy to private")
        if current_privacy in ("public", "draft") and new_privacy in ("public", "draft"):
            set_fields["privacy"] = new_privacy
            if new_privacy == "public" and diary.get("published_at") is None:
                set_fields["published_at"] = datetime.now(UTC)

    if current_privacy == "private":
        if "encrypted_data" in updates and updates["encrypted_data"] is not None:
            ed = updates["encrypted_data"]
            if not isinstance(ed, dict) or not all(k in ed for k in ("ciphertext", "iv", "salt")):
                raise ValidationException(
                    "encrypted_data must contain ciphertext, iv, and salt"
                )
            set_fields["encrypted_data"] = ed
        if "tags" in updates and updates["tags"] is not None:
            set_fields["tags"] = _validate_tags(updates["tags"])
        if "emotion" in updates:
            set_fields["emotion"] = _validate_emotion(updates["emotion"])
    else:
        if "title" in updates and updates["title"] is not None:
            title = updates["title"]
            if len(title) > 200:
                raise ValidationException("Title exceeds 200 characters")
            set_fields["title"] = title

        if "content_html" in updates and updates["content_html"] is not None:
            html = sanitize_html(updates["content_html"])
            if len(html.encode("utf-8")) > 102400:
                raise ValidationException("Content exceeds 100KB limit after sanitization")
            set_fields["content_html"] = html

        if "content_text" in updates and updates["content_text"] is not None:
            if len(updates["content_text"].encode("utf-8")) > 51200:
                raise ValidationException("Content text exceeds 50KB limit")
            set_fields["content_text"] = updates["content_text"]

        if "comments_enabled" in updates and updates["comments_enabled"] is not None:
            set_fields["comments_enabled"] = updates["comments_enabled"]

        if "content_warnings" in updates and updates["content_warnings"] is not None:
            cw = [w.lower().strip() for w in updates["content_warnings"] if w.lower().strip() in VALID_WARNINGS]
            set_fields["content_warnings"] = cw

        if "tags" in updates and updates["tags"] is not None:
            set_fields["tags"] = _validate_tags(updates["tags"])

    if "emotion" in updates and current_privacy != "private":
        set_fields["emotion"] = _validate_emotion(updates["emotion"])

    if set_fields:
        set_fields["updated_at"] = datetime.now(UTC)
        await diary_repo.update(diary_id, set_fields)

    updated_diary = await diary_repo.get_by_id(diary_id)
    user_repo = UserRepository()
    author = await user_repo.get_by_id(str(diary["user_id"]))

    if updated_diary.get("privacy") == "public":
        _index_diary_async(updated_diary)
    elif "privacy" in updates and updates["privacy"] is not None:
        _remove_from_index_async(diary_id)

    return _build_diary_response(updated_diary, author, current_user)


async def delete_diary(diary_id: str, current_user: dict) -> None:
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    is_owner = str(diary["user_id"]) == str(current_user["_id"])
    is_admin = current_user.get("is_admin", False)
    if not is_owner and not is_admin:
        raise PermissionDeniedException("You do not own this diary")

    deleted = await diary_repo.delete_cascade(diary_id)
    if deleted > 0:
        user_repo = UserRepository()
        await user_repo.update_stats(str(diary["user_id"]), "diary_count", -1)
        _remove_from_index_async(diary_id)


async def list_public_diaries(
    current_user: dict | None = None,
    page: int = 1,
    per_page: int = 20,
    sort: str = "latest",
    order: str = "desc",
    tags: str | None = None,
    emotion: str | None = None,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    diary_repo = DiaryRepository()
    user_repo = UserRepository()

    sort_map = {"latest": "created_at", "updated": "updated_at", "popular": "stats.like_count"}
    sort_field = sort_map.get(sort, "created_at")
    sort_dir = -1 if order == "desc" else 1
    skip = (page - 1) * per_page

    tag_list = [t.strip().lower() for t in tags.split(",") if t.strip()] if tags else None
    emotion_val = emotion.lower().strip() if emotion else None

    has_filters = tag_list or emotion_val or year is not None
    if has_filters:
        diaries = await diary_repo.find_public_feed_filtered(
            tags=tag_list,
            emotion=emotion_val,
            year=year,
            month=month,
            skip=skip,
            limit=per_page,
            sort_field=sort_field,
            sort_dir=sort_dir,
        )
        total = await diary_repo.count_public_feed_filtered(
            tags=tag_list,
            emotion=emotion_val,
            year=year,
            month=month,
        )
    else:
        diaries = await diary_repo.find_public_feed(
            skip=skip,
            limit=per_page,
            sort_field=sort_field,
            sort_dir=sort_dir,
        )
        total = await diary_repo.count_public_feed()

    diary_ids = [d["_id"] for d in diaries]
    comment_counts = await diary_repo._collection.database.comments.aggregate([
        {"$match": {
            "diary_id": {"$in": diary_ids},
            "is_deleted": {"$ne": True},
            "parent_comment_id": None,
        }},
        {"$group": {"_id": "$diary_id", "count": {"$sum": 1}}},
    ]).to_list(length=len(diary_ids))
    count_map = {str(c["_id"]): c["count"] for c in comment_counts}

    from app.services.enrichment_service import enrich_diary_batch
    diaries = await enrich_diary_batch(diaries, current_user)

    author_cache: dict[str, dict] = {}
    data = []
    for diary in diaries:
        did = str(diary["_id"])
        diary["stats"]["comment_count"] = count_map.get(did, 0)
        author_id = str(diary["user_id"])
        if author_id not in author_cache:
            author = await user_repo.get_by_id(author_id)
            author_cache[author_id] = author if author else {"_id": author_id, "username": "unknown"}
        data.append(_build_diary_list_item(diary, author_cache[author_id], current_user))

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


async def get_random_diary(current_user: dict | None = None) -> dict | None:
    diary_repo = DiaryRepository()
    diary = await diary_repo.find_random_public()
    if diary is None:
        raise NotFoundException("No public diaries available")

    user_repo = UserRepository()
    author = await user_repo.get_by_id(str(diary["user_id"]))
    if author is None:
        author = {"_id": str(diary["user_id"]), "username": "unknown"}

    return _build_diary_response(diary, author, current_user)


async def list_my_diaries(
    user: dict,
    page: int = 1,
    per_page: int = 20,
    privacy: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
) -> dict:
    diary_repo = DiaryRepository()

    sort_field = sort if sort in ("created_at", "updated_at") else "created_at"
    sort_dir = -1 if order == "desc" else 1
    skip = (page - 1) * per_page

    diaries = await diary_repo.find_user_diaries(
        str(user["_id"]),
        privacy=privacy,
        skip=skip,
        limit=per_page,
        sort=[(sort_field, sort_dir)],
    )
    total = await diary_repo.count_user_diaries(str(user["_id"]), privacy=privacy)

    author_info = _build_author(user)
    data = []
    for diary in diaries:
        item = _build_diary_list_item(diary, {"_id": str(user["_id"]), "username": user["username"]}, current_user=user)
        item["author"] = author_info
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


async def get_my_diaries_stats(user_id: str) -> dict:
    diary_repo = DiaryRepository()
    all_count = await diary_repo.count_user_diaries(user_id)
    public_count = await diary_repo.count_user_diaries(user_id, "public")
    draft_count = await diary_repo.count_user_diaries(user_id, "draft")
    private_count = await diary_repo.count_user_diaries(user_id, "private")
    return {
        "all": all_count,
        "public": public_count,
        "draft": draft_count,
        "private": private_count,
    }
