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


def _build_author(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "avatar_path": user.get("avatar_path"),
    }


def _build_comment_response(comment: dict, author: dict, current_user: dict | None = None, diary: dict | None = None) -> dict:
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
        "created_at": fmt_dt(comment.get("created_at")),
        "updated_at": fmt_dt(comment.get("updated_at")),
    }


async def create_comment(diary_id: str, content: str, current_user: dict) -> dict:
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
    now = datetime.now(UTC)
    comment_doc = {
        "diary_id": diary["_id"],
        "user_id": current_user["_id"],
        "content": content,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    comment_id = await comment_repo.create(comment_doc)

    await diary_repo._collection.update_one(
        {"_id": diary["_id"]},
        {"$inc": {"stats.comment_count": 1}},
    )

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

    author_ids = list({str(c["user_id"]) for c in comments})
    user_repo = UserRepository()
    author_map: dict[str, dict] = {}
    for aid in author_ids:
        user = await user_repo.get_by_id(aid)
        if user:
            author_map[str(user["_id"])] = user

    data = []
    for comment in comments:
        author = author_map.get(str(comment["user_id"]), {"_id": str(comment["user_id"]), "username": "[deleted]"})
        data.append(_build_comment_response(comment, author, current_user, diary))

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


async def delete_comment(comment_id: str, current_user: dict) -> None:
    comment_repo = CommentRepository()
    comment = await comment_repo.get_by_id(comment_id)
    if comment is None:
        raise NotFoundException("Comment not found")

    is_author = str(comment["user_id"]) == str(current_user["_id"])

    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(str(comment["diary_id"]))
    is_diary_owner = diary and str(diary["user_id"]) == str(current_user["_id"])
    is_admin = current_user.get("is_admin", False)

    if not is_author and not is_diary_owner and not is_admin:
        raise PermissionDeniedException("You do not have permission to delete this comment")

    await comment_repo.soft_delete(comment_id)
