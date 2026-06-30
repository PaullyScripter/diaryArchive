import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import get_current_user
from app.core.exceptions import RateLimitException
from app.core.security import check_rate_limit
from app.core.utils import fmt_dt
from app.repositories.notification_repo import NotificationRepository

router = APIRouter(tags=["notifications"])
logger = logging.getLogger(__name__)


def _time_ago(created_at: datetime) -> str:
    now = datetime.now(UTC)
    delta = now - created_at.replace(tzinfo=UTC) if created_at.tzinfo is None else now - created_at
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days < 7:
        return f"{days}d ago"
    weeks = days // 7
    if weeks < 4:
        return f"{weeks}w ago"
    months = days // 30
    return f"{months}mo ago"


def _format_notification(n: dict) -> dict:
    actor_avatar = n.get("actor_avatar_path")
    return {
        "id": str(n["_id"]),
        "type": n["type"],
        "actor_username": n["actor_username"],
        "actor_avatar_path": actor_avatar if isinstance(actor_avatar, str) else None,
        "message": n["message"],
        "target_id": str(n["target_id"]) if n.get("target_id") else None,
        "target_type": n.get("target_type"),
        "read": n.get("read", False),
        "created_at": fmt_dt(n["created_at"]),
        "time_ago": _time_ago(n["created_at"]),
        "metadata": n.get("metadata", {}),
    }


@router.get("/notifications")
async def list_notifications(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:notifications_list:{current_user['_id']}", 20, 60
    )
    if is_limited:
        raise RateLimitException("Too many requests")
    repo = NotificationRepository()
    user_id = str(current_user["_id"])
    skip = (page - 1) * per_page

    notifications = await repo.find_by_user(user_id, skip=skip, limit=per_page)
    total = await repo.count_by_user(user_id)
    unread = await repo.count_unread(user_id)

    return {
        "data": [_format_notification(n) for n in notifications],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": skip + per_page < total,
            "has_prev": page > 1,
            "unread_count": unread,
        },
    }


@router.get("/notifications/unread-count")
async def unread_count(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:notifications_unread:{current_user['_id']}", 30, 60
    )
    if is_limited:
        raise RateLimitException("Too many requests")
    repo = NotificationRepository()
    count = await repo.count_unread(str(current_user["_id"]))
    return {"data": {"unread_count": count}}


@router.put("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:notifications_mark_read:{current_user['_id']}", 10, 60
    )
    if is_limited:
        raise RateLimitException("Too many requests")
    repo = NotificationRepository()
    updated = await repo.mark_read(notification_id, str(current_user["_id"]))
    if not updated:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Notification not found")
    return {"data": {"message": "Notification marked as read"}}


@router.put("/notifications/read-all")
async def mark_all_read(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:notifications_mark_all:{current_user['_id']}", 5, 60
    )
    if is_limited:
        raise RateLimitException("Too many requests")
    repo = NotificationRepository()
    count = await repo.mark_all_read(str(current_user["_id"]))
    return {"data": {"message": "All notifications marked as read", "count": count}}
