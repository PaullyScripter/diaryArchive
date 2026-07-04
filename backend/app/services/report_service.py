import logging

from bson import ObjectId

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.repositories.comment_repo import CommentRepository
from app.repositories.diary_repo import DiaryRepository
from app.repositories.report_repo import ReportRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


async def validate_target_exists(target_type: str, target_id: str) -> None:
    if not ObjectId.is_valid(target_id):
        raise NotFoundException(f"{target_type.capitalize()} not found")

    if target_type == "diary":
        repo = DiaryRepository()
        target = await repo.get_by_id(target_id)
    elif target_type == "comment":
        repo = CommentRepository()
        target = await repo.get_by_id(target_id)
    elif target_type == "user":
        repo = UserRepository()
        target = await repo.get_by_id(target_id)
    else:
        raise ValidationException(f"Invalid target_type: {target_type}")

    if target is None:
        raise NotFoundException(f"{target_type.capitalize()} not found")


async def submit_report(
    reporter_id: str,
    target_type: str,
    target_id: str,
    reason: str,
    description: str | None = None,
) -> dict:
    await validate_target_exists(target_type, target_id)

    report_repo = ReportRepository()
    duplicate = await report_repo.find_duplicate(reporter_id, target_type, target_id)
    if duplicate:
        raise ConflictException("You have already submitted a pending report for this target")

    report_doc = {
        "reporter_id": ObjectId(reporter_id),
        "target_type": target_type,
        "target_id": ObjectId(target_id),
        "reason": reason,
        "description": description,
    }
    report_id = await report_repo.create_report(report_doc)

    user_repo = UserRepository()
    reporter = await user_repo.get_by_id(reporter_id)
    reporter_username = reporter.get("username", "unknown") if reporter else "unknown"

    return {
        "id": report_id,
        "reporter": {"id": reporter_id, "username": reporter_username},
        "target_type": target_type,
        "target_id": target_id,
        "reason": reason,
        "description": description,
        "status": "pending",
    }


async def list_reports(
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    skip = (page - 1) * per_page
    report_repo = ReportRepository()
    reports = await report_repo.find_reports(
        status=status,
        skip=skip,
        limit=per_page,
    )
    total = await report_repo.count_reports(status=status)

    user_repo = UserRepository()
    reporter_ids = list({str(r["reporter_id"]) for r in reports})
    reporters_map = {}
    if reporter_ids:
        users = await user_repo.find_by_ids(reporter_ids)
        reporters_map = {str(u["_id"]): u for u in users}

    diary_ids = [str(r["target_id"]) for r in reports if r["target_type"] == "diary"]
    comment_ids = [str(r["target_id"]) for r in reports if r["target_type"] == "comment"]
    user_target_ids = [str(r["target_id"]) for r in reports if r["target_type"] == "user"]

    diary_repo = DiaryRepository()
    comment_repo = CommentRepository()

    diaries_map = {}
    if diary_ids:
        diaries = await diary_repo.find_by_ids(diary_ids)
        diaries_map = {str(d["_id"]): d for d in diaries}

    comments_map = {}
    if comment_ids:
        comments = await comment_repo.find_by_ids(comment_ids)
        comments_map = {str(c["_id"]): c for c in comments}

    users_map = {}
    if user_target_ids:
        users_list = await user_repo.find_by_ids(user_target_ids)
        users_map = {str(u["_id"]): u for u in users_list}

    all_user_ids = set()
    for d in diaries_map.values():
        all_user_ids.add(str(d.get("user_id", "")))
    for c in comments_map.values():
        all_user_ids.add(str(c.get("user_id", "")))
    all_user_ids.discard("")

    author_map = {}
    if all_user_ids:
        authors = await user_repo.find_by_ids(list(all_user_ids))
        author_map = {str(u["_id"]): u for u in authors}

    result = []
    for r in reports:
        rid = str(r["reporter_id"])
        reporter_user = reporters_map.get(rid, {})
        target_preview = _build_target_preview(
            r["target_type"], str(r["target_id"]),
            diaries_map, comments_map, users_map, author_map,
        )
        result.append({
            "id": str(r["_id"]),
            "reporter": {
                "id": rid,
                "username": reporter_user.get("username", "unknown"),
            },
            "target_type": r["target_type"],
            "target_id": str(r["target_id"]),
            "target_preview": target_preview,
            "reason": r["reason"],
            "description": r.get("description"),
            "status": r.get("status", "pending"),
            "resolution_note": r.get("resolution_note"),
            "resolved_by": r.get("resolved_by"),
            "resolved_at": r.get("resolved_at"),
            "created_at": r["created_at"],
        })

    has_next = skip + per_page < total
    has_prev = page > 1

    return {
        "data": result,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": has_next,
            "has_prev": has_prev,
        },
    }


def _build_target_preview(
    target_type: str,
    target_id: str,
    diaries_map: dict,
    comments_map: dict,
    users_map: dict,
    author_map: dict,
) -> dict:
    if target_type == "diary":
        diary = diaries_map.get(target_id)
        if diary:
            author_id = str(diary.get("user_id", ""))
            author = author_map.get(author_id, {})
            content_text = diary.get("content_text", "") or ""
            return {
                "title": diary.get("title") or "Untitled",
                "author_username": author.get("username") or "unknown",
                "excerpt": content_text[:300] if content_text else None,
                "tags": diary.get("tags", []),
                "content_deleted": diary.get("is_deleted", False),
            }
        return {"title": "[Deleted]", "author_username": "unknown", "excerpt": None, "tags": [], "content_deleted": True}

    if target_type == "comment":
        comment = comments_map.get(target_id)
        if comment:
            author_id = str(comment.get("user_id", ""))
            author = author_map.get(author_id, {})
            content = comment.get("content") if not comment.get("is_deleted") else None
            return {
                "content": content,
                "author_username": author.get("username") or "unknown",
                "content_deleted": comment.get("is_deleted", False),
                "diary_id": str(comment.get("diary_id", "")),
            }
        return {"content": None, "author_username": "unknown", "content_deleted": True, "diary_id": ""}

    if target_type == "user":
        target_user = users_map.get(target_id)
        if target_user:
            return {
                "username": target_user.get("username", "unknown"),
                "about": target_user.get("about"),
                "is_banned": target_user.get("is_banned", False),
            }
        return {"username": "unknown", "about": None, "is_banned": False}

    return {}


async def update_report(
    report_id: str,
    admin_id: str,
    admin_username: str,
    status: str,
    resolution_note: str | None = None,
) -> dict:
    report_repo = ReportRepository()
    report = await report_repo.get_by_id(report_id)
    if report is None:
        raise NotFoundException("Report not found")

    current_status = report.get("status")
    if current_status != "pending":
        raise ValidationException("Report has already been resolved or dismissed")

    if status == "resolved":
        if not resolution_note or len(resolution_note.strip()) < 10:
            raise ValidationException("Resolution note must be at least 10 characters")
    elif status == "dismissed":
        pass
    else:
        raise ValidationException("Status must be 'resolved' or 'dismissed'")

    success = await report_repo.resolve_report(report_id, admin_id, status, resolution_note)
    if not success:
        raise NotFoundException("Report not found")

    updated = await report_repo.get_by_id(report_id)
    return {
        "id": str(updated["_id"]) if updated else report_id,
        "status": status,
        "resolution_note": resolution_note,
        "resolved_by": admin_username,
        "resolved_at": updated.get("resolved_at") if updated else None,
    }
