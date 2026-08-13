import logging
from datetime import UTC, datetime

from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.repositories.comment_repo import CommentRepository
from app.repositories.diary_repo import DiaryRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)
from app.core.utils import fmt_dt


MAX_DEPTH = 4


def _build_author(user: dict) -> dict:
    badges_dict = user.get("displayed_badges") or {}
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "avatar_path": user.get("avatar_path"),
        "is_admin": bool(user.get("is_admin")),
        "badges": list(badges_dict.values()) if badges_dict else [],
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
    parent_author_id = None
    parent_content = None

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
        parent_author_id = str(parent["user_id"])
        parent_content = parent.get("content")

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
    else:
        await diary_repo._collection.update_one(
            {"_id": diary["_id"]},
            {"$inc": {"stats.comment_count": 1}},
        )
    from app.services.diary_service import _index_diary_async
    updated_diary = await diary_repo.get_by_id(str(diary["_id"]))
    if updated_diary:
        _index_diary_async(updated_diary)
    from app.services.notification_service import _send_notification_async
    _send_notification_async(
        recipient_id=str(diary["user_id"]),
        actor_id=str(current_user["_id"]),
        notification_type="comment",
        target_id=str(diary["_id"]),
        target_type="diary",
        metadata={
            "diary_title": diary.get("title"),
            "comment_excerpt": content[:100],
            "comment_id": str(comment_id),
        },
    )
    if parent_author_id and parent_author_id != str(diary["user_id"]):
        _send_notification_async(
            recipient_id=parent_author_id,
            actor_id=str(current_user["_id"]),
            notification_type="comment",
            target_id=str(diary["_id"]),
            target_type="comment",
            metadata={
                "diary_title": diary.get("title"),
                "comment_excerpt": content[:100],
                "comment_id": str(comment_id),
                "parent_content": (parent_content or "")[:100],
            },
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
        is_owner = current_user and str(diary.get("user_id")) == str(current_user.get("_id"))
        if not is_owner:
            raise NotFoundException("Diary not found")

    user_repo = UserRepository()
    diary_author = await user_repo.get_by_id(str(diary["user_id"]))
    if diary_author and diary_author.get("is_banned") and not (current_user and str(current_user["_id"]) == str(diary["user_id"])):
        raise NotFoundException("Diary not found")

    banned_ids = await user_repo.get_banned_user_ids()

    comment_repo = CommentRepository()
    skip = (page - 1) * per_page
    comments = await comment_repo.find_by_diary(
        diary_id, skip=skip, limit=per_page,
        exclude_user_ids=banned_ids if banned_ids else None,
    )
    total = await comment_repo.count_by_diary(
        diary_id,
        exclude_user_ids=banned_ids if banned_ids else None,
    )

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
    if diary is None:
        raise NotFoundException("Diary not found")

    if diary.get("privacy") != "public":
        is_owner = current_user and str(diary.get("user_id")) == str(current_user.get("_id"))
        if not is_owner:
            raise NotFoundException("Diary not found")

    user_repo = UserRepository()
    diary_author = await user_repo.get_by_id(str(diary["user_id"]))
    if diary_author and diary_author.get("is_banned") and not (current_user and str(current_user["_id"]) == str(diary["user_id"])):
        raise NotFoundException("Diary not found")

    banned_ids = await user_repo.get_banned_user_ids()

    skip = (page - 1) * per_page
    comments = await comment_repo.find_replies(
        comment_id, skip=skip, limit=per_page,
        exclude_user_ids=banned_ids if banned_ids else None,
    )
    total = await comment_repo.count_replies(
        comment_id,
        exclude_user_ids=banned_ids if banned_ids else None,
    )

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
    authors = await user_repo.find_by_ids(author_ids) if author_ids else []
    author_map = {str(u["_id"]): u for u in authors}

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


async def delete_comment(comment_id: str, diary_id: str, current_user: dict, admin_delete_reason: str | None = None) -> None:
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

    if is_admin and not is_author and not is_diary_owner:
        if not admin_delete_reason or len(admin_delete_reason.strip()) < 10:
            raise ValidationException("Admin deletion requires a reason of at least 10 characters")
        from app.services.audit_service import log_audit
        await log_audit(
            admin_id=str(current_user["_id"]),
            admin_username=current_user["username"],
            action="delete_comment",
            target_type="comment",
            target_id=comment_id,
            details={"diary_id": diary_id, "reason": admin_delete_reason.strip()},
        )
        from app.core.background import run_in_background
        from app.services.notification_service import create_notification

        comment_reason = admin_delete_reason.strip() if admin_delete_reason else "Content policy violation"
        diary_title = diary.get("title", "a diary")
        title = f'Your comment on "{diary_title}" was removed — {comment_reason}'
        body = (
            f"Hello,\n\n"
            f"Your comment on \"{diary_title}\" has been removed by an administrator"
            f" for the following reason: {comment_reason}.\n\n"
            f"Please review our Community Guidelines. Repeated violations may result"
            f" in account suspension or banning.\n\n"
            f"Regards,\nDiaryArchive Moderation"
        )

        async def _do_comment_notify():
            try:
                result = await create_notification(
                    recipient_id=str(comment["user_id"]),
                    actor_id=str(current_user["_id"]),
                    notification_type="comment_deleted",
                    target_id=comment_id,
                    target_type="comment",
                    metadata={
                        "diary_title": diary.get("title"),
                        "comment_excerpt": (comment.get("content") or "")[:80],
                        "reason": comment_reason,
                        "title": title,
                        "body": body,
                    },
                )
                logger.info("Comment delete notification sent: id=%s", result)
            except Exception:
                logger.warning("Failed comment delete notification", exc_info=True)

        run_in_background(_do_comment_notify())

    parent_id = comment.get("parent_comment_id")
    await comment_repo.soft_delete(comment_id)
    if parent_id:
        await comment_repo.inc_reply_count(str(parent_id), -1)
    else:
        await diary_repo._collection.update_one(
            {"_id": diary["_id"]},
            {"$inc": {"stats.comment_count": -1}},
        )
    from app.services.diary_service import _index_diary_async
    updated_diary = await diary_repo.get_by_id(str(diary["_id"]))
    if updated_diary:
        _index_diary_async(updated_diary)


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
