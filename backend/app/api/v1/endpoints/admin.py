import json
import logging
import time
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import get_current_admin, get_db
from app.core.database import DatabaseManager
from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.models.report import ReportUpdate
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.user_repo import UserRepository
from app.services.audit_service import list_audit_logs, log_audit
from app.services.report_service import list_reports, update_report

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

SENSITIVE_FIELDS = {
    "password_hash", "email_encrypted", "email_hash",
    "encrypted_master_key", "master_key_salt", "master_key_iv",
}


def _sanitize_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in SENSITIVE_FIELDS}


def _build_admin_user_item(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "avatar_path": user.get("avatar_path"),
        "is_admin": user.get("is_admin", False),
        "is_banned": user.get("is_banned", False),
        "stats": user.get("stats", {}),
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
    }


# ─── Reports ────────────────────────────────────────────────

@router.get("/reports")
async def admin_list_reports(
    status: str = Query("pending", description="pending, resolved, dismissed, all"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin),
):
    return await list_reports(status=status, page=page, per_page=per_page)


@router.put("/reports/{report_id}")
async def admin_update_report(
    report_id: str,
    body: ReportUpdate,
    request: Request,
    current_admin: dict = Depends(get_current_admin),
):
    if body.status.value == "pending":
        raise ValidationException("Cannot set report status back to pending")

    result = await update_report(
        report_id=report_id,
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        status=body.status.value,
        resolution_note=body.resolution_note,
    )

    await log_audit(
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        action=f"report_{body.status.value}",
        target_type="report",
        target_id=report_id,
        details={"resolution_note": body.resolution_note},
        ip_address=request.client.host if request.client else None,
    )

    return {"data": result}


# ─── Diary Hide ──────────────────────────────────────────────

@router.put("/diaries/{diary_id}/hide")
async def admin_hide_diary(
    diary_id: str,
    body: dict,
    request: Request,
    current_admin: dict = Depends(get_current_admin),
):
    reason = body.get("reason", "").strip()
    if len(reason) < 10:
        raise ValidationException("Hide reason must be at least 10 characters")

    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    await diary_repo.update(diary_id, {"privacy": "hidden"})

    await log_audit(
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        action="hide_diary",
        target_type="diary",
        target_id=diary_id,
        details={"title": diary.get("title"), "reason": reason},
        ip_address=request.client.host if request.client else None,
    )

    _remove_from_index(diary_id)

    try:
        await _send_admin_notification(
            recipient_id=str(diary["user_id"]),
            admin_id=str(current_admin["_id"]),
            admin_username=current_admin["username"],
            notification_type="diary_hidden",
            diary_title=diary.get("title", "Untitled"),
            reason=reason,
        )
    except Exception:
        logger.warning("Failed to send hide notification", exc_info=True)

    return {"data": {"id": diary_id, "hidden": True}}


@router.put("/diaries/{diary_id}/unhide")
async def admin_unhide_diary(
    diary_id: str,
    body: dict,
    request: Request,
    current_admin: dict = Depends(get_current_admin),
):
    diary_repo = DiaryRepository()
    diary = await diary_repo.get_by_id(diary_id)
    if diary is None:
        raise NotFoundException("Diary not found")

    reason = body.get("reason", "").strip() or "Restored by admin"

    await diary_repo.update(diary_id, {"privacy": "public"})

    await log_audit(
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        action="unhide_diary",
        target_type="diary",
        target_id=diary_id,
        details={"title": diary.get("title"), "reason": reason},
        ip_address=request.client.host if request.client else None,
    )

    updated = await diary_repo.get_by_id(diary_id)
    if updated and updated.get("privacy") == "public":
        _index_diary(updated)

    return {"data": {"id": diary_id, "hidden": False}}


def _remove_from_index(diary_id: str) -> None:
    try:
        from app.services.diary_service import _remove_from_index_async
        _remove_from_index_async(diary_id)
    except Exception:
        pass


def _index_diary(diary: dict) -> None:
    try:
        from app.services.diary_service import _index_diary_async
        _index_diary_async(diary)
    except Exception:
        pass


# ─── Users ──────────────────────────────────────────────────

@router.get("/users")
async def admin_list_users(
    q: str = Query(None, description="Username search prefix"),
    status: str = Query("all", description="active, banned, all"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin),
):
    skip = (page - 1) * per_page
    user_repo = UserRepository()

    is_banned = None
    if status == "active":
        is_banned = False
    elif status == "banned":
        is_banned = True

    users = await user_repo.search_users(
        query=q,
        is_banned=is_banned,
        skip=skip,
        limit=per_page,
    )
    total = await user_repo.count_users(query=q, is_banned=is_banned)

    result = [_build_admin_user_item(u) for u in users]

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


@router.put("/users/{user_id}/ban")
async def admin_ban_user(
    user_id: str,
    body: dict,
    request: Request,
    current_admin: dict = Depends(get_current_admin),
):
    is_banned = body.get("is_banned")
    reason = body.get("reason", "").strip()

    if is_banned is None:
        raise ValidationException("is_banned field is required")

    if str(current_admin["_id"]) == user_id:
        raise PermissionDeniedException("You cannot ban yourself")

    user_repo = UserRepository()
    target_user = await user_repo.get_by_id(user_id)
    if target_user is None:
        raise NotFoundException("User not found")

    if is_banned and target_user.get("is_admin"):
        raise PermissionDeniedException("Cannot ban another admin")

    if is_banned and len(reason) < 10:
        raise ValidationException("Ban reason must be at least 10 characters")

    await user_repo.set_ban_status(user_id, is_banned)

    if is_banned:
        refresh_repo = RefreshTokenRepository()
        revoked = await refresh_repo.delete_all_for_user(user_id)
        logger.info(
            "Admin %s banned user %s, revoked %d sessions",
            current_admin["username"], target_user["username"], revoked,
        )

    await log_audit(
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        action="ban_user" if is_banned else "unban_user",
        target_type="user",
        target_id=user_id,
        details={"is_banned": is_banned, "reason": reason or None, "target_username": target_user["username"]},
        ip_address=request.client.host if request.client else None,
    )

    return {"data": {
        "id": user_id,
        "username": target_user["username"],
        "is_banned": is_banned,
    }}


@router.put("/users/{user_id}/role")
async def admin_change_role(
    user_id: str,
    body: dict,
    request: Request,
    current_admin: dict = Depends(get_current_admin),
):
    is_admin_flag = body.get("is_admin")
    if is_admin_flag is None:
        raise ValidationException("is_admin field is required")

    if str(current_admin["_id"]) == user_id:
        raise PermissionDeniedException("You cannot change your own admin role")

    user_repo = UserRepository()
    target_user = await user_repo.get_by_id(user_id)
    if target_user is None:
        raise NotFoundException("User not found")

    if not is_admin_flag and target_user.get("is_admin"):
        admin_count = await user_repo.count_admins()
        if admin_count <= 1:
            raise PermissionDeniedException("Cannot demote the last admin")

    await user_repo.set_admin_role(user_id, is_admin_flag)

    await log_audit(
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        action="promote_admin" if is_admin_flag else "demote_admin",
        target_type="user",
        target_id=user_id,
        details={"is_admin": is_admin_flag, "target_username": target_user["username"]},
        ip_address=request.client.host if request.client else None,
    )

    return {"data": {
        "id": user_id,
        "username": target_user["username"],
        "is_admin": is_admin_flag,
    }}


# ─── Audit Logs ─────────────────────────────────────────────

@router.get("/audit-logs")
async def admin_audit_logs(
    action: str = Query(None),
    admin_id: str = Query(None),
    target_type: str = Query(None),
    from_date: str = Query(None, description="ISO date string"),
    to_date: str = Query(None, description="ISO date string"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin),
):
    from_dt = None
    to_dt = None
    if from_date:
        from_dt = datetime.fromisoformat(from_date)
    if to_date:
        to_dt = datetime.fromisoformat(to_date)

    return await list_audit_logs(
        action=action,
        admin_id=admin_id,
        target_type=target_type,
        from_date=from_dt,
        to_date=to_dt,
        page=page,
        per_page=per_page,
    )


# ─── Stats ──────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    current_admin: dict = Depends(get_current_admin),
):
    cache_key = "admin:stats"
    try:
        redis = DatabaseManager.get_redis()
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except RuntimeError:
        pass

    db = DatabaseManager.get_db()
    user_repo = UserRepository()

    total_users = await user_repo.count()
    banned_users = await user_repo.count_users(is_banned=True)
    admin_count = await user_repo.count_admins()

    total_diaries = await db.diaries.count_documents({})
    public_diaries = await db.diaries.count_documents({"privacy": "public"})
    private_diaries = await db.diaries.count_documents({"privacy": "private"})

    total_comments = await db.comments.count_documents({})
    total_likes = await db.likes.count_documents({})
    total_bookmarks = await db.bookmarks.count_documents({})

    pending_reports = await db.reports.count_documents({"status": "pending"})

    stats = {
        "data": {
            "users": {
                "total": total_users,
                "banned": banned_users,
                "admins": admin_count,
            },
            "diaries": {
                "total": total_diaries,
                "public": public_diaries,
                "private": private_diaries,
            },
            "interactions": {
                "comments": total_comments,
                "likes": total_likes,
                "bookmarks": total_bookmarks,
            },
            "reports": {
                "pending": pending_reports,
            },
            "system": {
                "timestamp": datetime.now(UTC).isoformat(),
            },
        },
    }

    try:
        redis = DatabaseManager.get_redis()
        await redis.setex(cache_key, 300, json.dumps(stats, default=str))
    except RuntimeError:
        pass

    return stats


# ─── Health ─────────────────────────────────────────────────

@router.get("/health")
async def admin_health(
    current_admin: dict = Depends(get_current_admin),
):
    checks: dict = {}
    healthy = True

    t0 = time.monotonic()
    try:
        db = DatabaseManager.get_db()
        await db.command("ping")
        latency = round((time.monotonic() - t0) * 1000)
        checks["mongodb"] = {"status": "healthy", "latency_ms": latency}
    except Exception as e:
        latency = round((time.monotonic() - t0) * 1000)
        checks["mongodb"] = {"status": "unhealthy", "latency_ms": latency, "error": str(e)}
        healthy = False

    t0 = time.monotonic()
    try:
        redis = DatabaseManager.get_redis()
        await redis.ping()
        latency = round((time.monotonic() - t0) * 1000)
        checks["redis"] = {"status": "healthy", "latency_ms": latency}
    except Exception as e:
        latency = round((time.monotonic() - t0) * 1000)
        checks["redis"] = {"status": "unhealthy", "latency_ms": latency, "error": str(e)}
        healthy = False

    t0 = time.monotonic()
    try:
        import asyncio as _asyncio
        from app.search.config import get_client as get_meili_client
        client = get_meili_client()
        await _asyncio.to_thread(client.health)
        latency = round((time.monotonic() - t0) * 1000)
        checks["meilisearch"] = {"status": "healthy", "latency_ms": latency}
    except Exception as e:
        latency = round((time.monotonic() - t0) * 1000)
        checks["meilisearch"] = {"status": "unhealthy", "latency_ms": latency, "error": str(e)}
        healthy = False

    return {
        "data": {
            "status": "healthy" if healthy else "degraded",
            "checks": checks,
            "timestamp": datetime.now(UTC).isoformat(),
        },
    }


POLICY_REMINDER = (
    " Repeated violations of our Community Guidelines may result in account suspension or banning."
)


async def _send_admin_notification(
    recipient_id: str,
    admin_id: str,
    admin_username: str,
    notification_type: str,
    diary_title: str | None = None,
    comment_text: str | None = None,
    reason: str | None = None,
) -> None:
    from app.services.notification_service import create_notification

    type_labels = {
        "diary_hidden": "your diary",
        "diary_deleted": "your diary",
        "comment_deleted": "your comment",
    }
    type_actions = {
        "diary_hidden": "hidden",
        "diary_deleted": "removed",
        "comment_deleted": "removed",
    }
    target = type_labels.get(notification_type, "your content")
    action = type_actions.get(notification_type, "moderated")
    title = f'Your {target} "{diary_title or "Untitled"}" was {action}'

    if reason:
        title += f" — {reason}"

    body = (
        f"Hello,\n\n"
        f"Your {target} \"{diary_title or 'Untitled'}\" has been {action} by an administrator"
        f" for the following reason: {reason or 'Content policy violation'}.\n\n"
        f"Please review our Community Guidelines. Repeated violations may result"
        f" in account suspension or banning.\n\n"
        f"Regards,\nDiaryArchive Moderation"
    )

    result = await create_notification(
        recipient_id=recipient_id,
        actor_id=admin_id,
        notification_type=notification_type,
        target_id=None,
        target_type="diary",
        metadata={
            "diary_title": diary_title,
            "reason": reason,
            "title": title,
            "body": body,
        },
    )
    logger.info("Admin notification sent: id=%s type=%s recipient=%s",
                 result, notification_type, recipient_id)
