from datetime import UTC, datetime

from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.repositories.comment_repo import CommentRepository
from app.repositories.diary_repo import DiaryRepository
from app.repositories.user_repo import UserRepository
from app.core.utils import fmt_dt


MAX_DEPTH = 4


def _build_author(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "avatar_path": user.get("avatar_path"),
    }


def _build_comment_response(
    comment: dict,
    author: dict,
    current_user: dict | None = None,
    diary: dict | None = None,
    like_count: int = 0,
    is_liked: bool = False,
) -> dict:
    is_owner = False
    is_diary_owner = False
    if current_user:
        is_owner = str(comment["user_id"]) == str(current_user["_id"])
        if diary:
            is_diary_owner = str(diary["user_id"]) == str(current_user["_id"])

    return {
        "id": str(comment["_id"]),
        "content": comment.get("content") if not comment.get("is_deleted") else None,
        "author": _build_author(author),
        "is_deleted": comment.get("is_deleted", False),
        "is_owner": is_owner,
        "is_diary_owner": is_diary_owner,
        "parent_comment_id": str(comment["parent_comment_id"]) if comment.get("parent_comment_id") else None,
        "depth": comment.get("depth", 0),
        "reply_count": comment.get("reply_count", 0),
        "like_count": like_count if like_count > 0 else comment.get("like_count", 0),
        "is_liked": is_liked,
        "created_at": fmt_dt(comment.get("created_at")),
        "updated_at": fmt_dt(comment.get("updated_at")),
    }


async def create_comment(
    diary_id: str,
    content: str,
    current_user: dict,
    parent_comment_id: str | None = None,
) -> dict:
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    if diary.get("privacy") != "public":
        is_owner = str(diary["user_id"]) == str(current_user["_id"])
        if not is_owner:
            raise NotFoundException("Diary not found")

    if not diary.get("comments_enabled", True):
        raise ValidationException("Comments are disabled on this diary")

    if diary.get("comments_locked", False):
        raise ValidationException("Comments are locked on this diary")

    content = content.strip()
    if not content or len(content) > 2000:
        raise ValidationException("Comment must be between 1 and 2000 characters")

    comment_repo = CommentRepository()
    depth = 0
    root_id = None

    if parent_comment_id:
        parent = await comment_repo.get_by_id(parent_comment_id)
        if parent is None:
            raise NotFoundException("Parent comment not found")
        if str(parent["diary_id"]) != diary_id:
            raise ValidationException("Parent comment does not belong to this diary")
        depth = parent.get("depth", 0) + 1
        if depth > MAX_DEPTH:
            raise ValidationException("Maximum reply depth reached")
        root_id = parent.get("root_comment_id") or parent["_id"]

    now = datetime.now(UTC)
    comment_doc = {
        "diary_id": diary["_id"],
        "user_id": current_user["_id"],
        "content": content,
        "is_deleted": False,
        "parent_comment_id": diary["_id"].__class__(parent_comment_id) if parent_comment_id else None,
        "root_comment_id": root_id,
        "depth": depth,
        "reply_count": 0,
        "like_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    comment_id = await comment_repo.create(comment_doc)

    if parent_comment_id:
        await comment_repo.inc_reply_count(parent_comment_id, 1)

    await diary_repo._collection.update_one(
        {"_id": diary["_id"]},
        {"$inc": {"stats.comment_count": 1}},
    )

    comment_doc["_id"] = comment_id
    return _build_comment_response(comment_doc, current_user, current_user, diary)


async def list_comments(
    diary_id: str,
    page: int = 1,
    per_page: int = 50,
    current_user: dict | None = None,
) -> dict:
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    if diary.get("privacy") != "public":
        raise NotFoundException("Diary not found")

    comment_repo = CommentRepository()
    skip = (page - 1) * per_page
    comments = await comment_repo.find_by_diary(diary_id, skip=skip, limit=per_page)
    total = await comment_repo.count_by_diary(diary_id)

    return await _enrich_and_format(comments, current_user, diary, page, per_page, total)


async def list_replies(
    comment_id: str,
    page: int = 1,
    per_page: int = 10,
    current_user: dict | None = None,
) -> dict:
    comment_repo = CommentRepository()
    parent = await comment_repo.get_by_id(comment_id)
    if parent is None:
        raise NotFoundException("Comment not found")

    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(str(parent["diary_id"]))
    if diary is None or diary.get("privacy") != "public":
        raise NotFoundException("Diary not found")

    skip = (page - 1) * per_page
    comments = await comment_repo.find_replies(comment_id, skip=skip, limit=per_page)
    total = await comment_repo.count_replies(comment_id)

    return await _enrich_and_format(comments, current_user, diary, page, per_page, total)


async def _enrich_and_format(
    comments: list[dict],
    current_user: dict | None,
    diary: dict,
    page: int,
    per_page: int,
    total: int,
) -> dict:
    comment_repo = CommentRepository()
    author_ids = list({str(c["user_id"]) for c in comments})
    user_repo = UserRepository()
    author_map: dict[str, dict] = {}
    for aid in author_ids:
        user = await user_repo.get_by_id(aid)
        if user:
            author_map[str(user["_id"])] = user

    liked_ids: set[str] = set()
    if current_user:
        comment_ids = [str(c["_id"]) for c in comments]
        liked_ids = await comment_repo.batch_has_comment_likes(comment_ids, str(current_user["_id"]))

    data = []
    for comment in comments:
        author = author_map.get(str(comment["user_id"]), {"_id": str(comment["user_id"]), "username": "[deleted]"})
        is_liked = str(comment["_id"]) in liked_ids
        data.append(_build_comment_response(comment, author, current_user, diary, is_liked=is_liked))

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


async def delete_comment(comment_id: str, diary_id: str, current_user: dict) -> None:
    comment_repo = CommentRepository()
    comment = await comment_repo.get_by_id(comment_id)
    if comment is None:
        raise NotFoundException("Comment not found")

    if str(comment["diary_id"]) != diary_id:
        raise NotFoundException("Comment not found on this diary")

    is_author = str(comment["user_id"]) == str(current_user["_id"])

    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(str(comment["diary_id"]))
    is_diary_owner = diary and str(diary["user_id"]) == str(current_user["_id"])
    is_admin = current_user.get("is_admin", False)

    if not is_author and not is_diary_owner and not is_admin:
        raise PermissionDeniedException("You do not have permission to delete this comment")

    parent_id = comment.get("parent_comment_id")
    await comment_repo.soft_delete(comment_id)
    if parent_id:
        await comment_repo.inc_reply_count(str(parent_id), -1)

    await diary_repo._collection.update_one(
        {"_id": diary["_id"]},
        {"$inc": {"stats.comment_count": -1}},
    )


async def toggle_comment_like(comment_id: str, current_user: dict) -> dict:
    comment_repo = CommentRepository()
    comment = await comment_repo.get_by_id(comment_id)
    if comment is None:
        raise NotFoundException("Comment not found")

    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(str(comment["diary_id"]))
    if diary is None or diary.get("privacy") != "public":
        is_owner = diary and str(diary["user_id"]) == str(current_user["_id"])
        if not is_owner:
            raise NotFoundException("Comment not found")

    user_id = str(current_user["_id"])

    deleted = await comment_repo.find_one_and_delete_comment_like(comment_id, user_id)
    if deleted is not None:
        await comment_repo.inc_like_count(comment_id, -1)
        comment = await comment_repo.get_by_id(comment_id)
        return {"is_liked": False, "like_count": comment["like_count"] if comment else 0}

    try:
        await comment_repo.add_comment_like(comment_id, user_id)
    except Exception:
        comment = await comment_repo.get_by_id(comment_id)
        return {"is_liked": False, "like_count": comment["like_count"] if comment else 0}
    await comment_repo.inc_like_count(comment_id, 1)
    comment = await comment_repo.get_by_id(comment_id)
    return {"is_liked": True, "like_count": comment["like_count"] if comment else 0}
