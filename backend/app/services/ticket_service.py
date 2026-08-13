import logging
from datetime import timedelta

from bson import ObjectId

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
)
from app.repositories.ticket_repo import TicketRepository

logger = logging.getLogger(__name__)


async def create_ticket(
    user_id: str,
    user_username: str,
    category: str,
    subject: str,
    description: str,
) -> dict:
    ticket_repo = TicketRepository()
    ticket_doc = {
        "user_id": ObjectId(user_id),
        "user_username": user_username,
        "category": category,
        "subject": subject,
    }
    ticket_id = await ticket_repo.create_ticket(ticket_doc)

    if description:
        await ticket_repo.add_message(ticket_id, {
            "sender_id": user_id,
            "sender_username": user_username,
            "message": description,
        })

    ticket = await ticket_repo.get_by_id(ticket_id)
    return _build_ticket_response(ticket)


async def list_user_tickets(
    user_id: str,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    skip = (page - 1) * per_page
    ticket_repo = TicketRepository()
    tickets = await ticket_repo.find_by_user(user_id, skip=skip, limit=per_page)
    total = await ticket_repo.count_by_user(user_id)

    result = [_build_ticket_summary(t) for t in tickets]

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


async def list_all_tickets(
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    skip = (page - 1) * per_page
    ticket_repo = TicketRepository()
    tickets = await ticket_repo.find_all(status=status, skip=skip, limit=per_page)
    total = await ticket_repo.count_all(status=status)

    result = [_build_ticket_response(t) for t in tickets]

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


async def get_ticket(
    ticket_id: str, user_id: str | None = None, is_admin: bool = False
) -> dict:
    ticket_repo = TicketRepository()
    ticket = await ticket_repo.get_by_id(ticket_id)
    if ticket is None:
        raise NotFoundException("Ticket not found")

    if not is_admin and str(ticket["user_id"]) != user_id:
        raise PermissionDeniedException("You do not have permission to view this ticket")

    return {"data": _build_ticket_response(ticket)}


async def assign_ticket(
    ticket_id: str, admin_id: str, admin_username: str
) -> dict:
    ticket_repo = TicketRepository()
    ticket = await ticket_repo.get_by_id(ticket_id)
    if ticket is None:
        raise NotFoundException("Ticket not found")

    if ticket.get("status") == "closed":
        raise ValidationException("Cannot assign a closed ticket")

    if ticket.get("assigned_admin_id"):
        raise ConflictException("Ticket is already assigned to an admin")

    success = await ticket_repo.assign_admin(ticket_id, admin_id, admin_username)
    if not success:
        raise NotFoundException("Ticket not found")

    updated = await ticket_repo.get_by_id(ticket_id)
    return {"data": _build_ticket_response(updated)}


async def add_message(
    ticket_id: str,
    sender_id: str,
    sender_username: str,
    message: str,
    is_admin: bool = False,
    media_id: str | None = None,
) -> dict:
    ticket_repo = TicketRepository()
    ticket = await ticket_repo.get_by_id(ticket_id)
    if ticket is None:
        raise NotFoundException("Ticket not found")

    if ticket.get("status") == "closed":
        raise ValidationException("Cannot reply to a closed ticket")

    if not is_admin and str(ticket["user_id"]) != sender_id:
        raise PermissionDeniedException("You do not have permission to reply to this ticket")

    if is_admin:
        assigned_admin_id = ticket.get("assigned_admin_id")
        if assigned_admin_id and str(assigned_admin_id) != sender_id:
            raise PermissionDeniedException("Only the assigned admin can reply to this ticket")

    msg_doc: dict = {
        "sender_id": sender_id,
        "sender_username": sender_username,
        "message": message,
    }
    if media_id:
        from app.repositories.media_repo import MediaRepository
        media_repo = MediaRepository()
        media = await media_repo.get_by_id(media_id)
        if media and str(media["user_id"]) == sender_id:
            from app.core.minio_client import get_minio_client
            from app.core.config import settings
            import asyncio
            stored_path = media["stored_path"]
            msg_doc["media_id"] = media_id
            msg_doc["media_type"] = media.get("mime_type", "")
            if media.get("is_private"):
                client = get_minio_client()
                msg_doc["media_url"] = await asyncio.to_thread(
                    lambda: client.presigned_get_object(settings.minio_bucket, stored_path, expires=timedelta(hours=24))
                )
            else:
                msg_doc["media_url"] = f"{settings.minio_endpoint}/{settings.minio_bucket}/{stored_path}"

    success = await ticket_repo.add_message(ticket_id, msg_doc)
    if not success:
        raise NotFoundException("Ticket not found")

    updated = await ticket_repo.get_by_id(ticket_id)
    return {"data": _build_ticket_response(updated)}


async def close_ticket(ticket_id: str, user_id: str | None = None) -> dict:
    ticket_repo = TicketRepository()
    ticket = await ticket_repo.get_by_id(ticket_id)
    if ticket is None:
        raise NotFoundException("Ticket not found")

    if ticket.get("status") == "closed":
        raise ValidationException("Ticket is already closed")

    if user_id and str(ticket["user_id"]) != user_id:
        raise PermissionDeniedException("You do not have permission to close this ticket")

    success = await ticket_repo.close_ticket(ticket_id)
    if not success:
        raise NotFoundException("Ticket not found")

    updated = await ticket_repo.get_by_id(ticket_id)
    return {"data": _build_ticket_response(updated)}


async def resolve_ticket(
    ticket_id: str,
    admin_id: str,
    admin_username: str,
    action: str,
    response_message: str,
) -> dict:
    ticket_repo = TicketRepository()
    ticket = await ticket_repo.get_by_id(ticket_id)
    if ticket is None:
        raise NotFoundException("Ticket not found")

    if ticket.get("status") == "closed":
        raise ValidationException("Ticket is already closed")

    target_user_id = str(ticket["user_id"])

    from app.repositories.user_repo import UserRepository
    from app.repositories.refresh_token_repo import RefreshTokenRepository
    from app.services.notification_service import create_notification as create_notif

    user_repo = UserRepository()
    target_user = await user_repo.get_by_id(target_user_id)

    if action == "accept":
        if not target_user:
            raise NotFoundException("User not found")

        await user_repo._collection.update_one(
            {"_id": target_user["_id"]},
            {"$set": {"is_banned": False, "bio_warning_count": 0},
             "$unset": {
                 "banned_at": "", "ban_reason": "",
                 "bio_warning_deadline": "", "bio_warning_reason": "",
                 "bio_warning_awaiting_review": "", "bio_edit_banned_until": "",
                 "username_warning_deadline": "", "username_warning_reason": "",
             }},
        )

        _clear_appeal_rate_limits(target_user.get("username", ""))

        try:
            from app.core.database import DatabaseManager
            db = DatabaseManager.get_db()
            cursor = db.diaries.find({"user_id": target_user["_id"], "privacy": "public"})
            async for diary in cursor:
                from app.services.diary_service import _index_diary_async
                _index_diary_async(diary)
        except Exception:
            logger.warning("Failed to re-index diaries after appeal accept", exc_info=True)

        notification_title = "Appeal Accepted - Account Unbanned"
        notification_body = (
            f"Hello {target_user['username']},\n\n"
            f"Your ban appeal has been reviewed and accepted.\n\n"
            f"{response_message}\n\n"
            f"Your account has been unbanned. You may now log in again.\n\n"
            f"Regards,\nDiaryArchive Moderation"
        )

    elif action == "deny":
        notification_title = "Appeal Denied"
        notification_body = (
            f"Hello {target_user.get('username', 'User')},\n\n"
            f"Your ban appeal has been reviewed and denied.\n\n"
            f"{response_message}\n\n"
            f"Your account remains banned. You may submit another appeal"
            f" at a later date.\n\n"
            f"Regards,\nDiaryArchive Moderation"
        )

    else:
        raise ValidationException("action must be 'accept' or 'deny'")

    admin_msg_doc = {
        "sender_id": admin_id,
        "sender_username": admin_username,
        "message": response_message,
    }
    await ticket_repo.add_message(ticket_id, admin_msg_doc)

    if action == "accept":
        await ticket_repo.delete(ticket_id)
    else:
        await ticket_repo._collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": {"resolution": "denied", "resolution_message": response_message}},
        )
        await ticket_repo.close_ticket(ticket_id)

    try:
        await create_notif(
            recipient_id=target_user_id,
            actor_id=admin_id,
            notification_type="account_help",
            target_type="ticket",
            target_id=ticket_id,
            metadata={
                "title": notification_title,
                "body": notification_body,
                "action": action,
            },
        )
    except Exception:
        logger.warning("Failed to send appeal resolution notification", exc_info=True)

    updated = await ticket_repo.get_by_id(ticket_id)
    return {"data": _build_ticket_response(updated)}


async def get_user_appeals(user_id: str) -> list[dict]:
    ticket_repo = TicketRepository()
    tickets = await ticket_repo.find_by_user(user_id)
    appeal_tickets = [
        t for t in tickets if t.get("category") == "account_help"
    ]
    return [_build_ticket_summary(t) for t in appeal_tickets]


def _build_ticket_response(ticket: dict | None) -> dict:
    if ticket is None:
        return {}
    ticket_user_id = str(ticket.get("user_id", "")) if ticket.get("user_id") else ""
    messages = []
    for m in ticket.get("messages", []) or []:
        sender_id = str(m.get("sender_id", "")) if m.get("sender_id") else ""
        messages.append({
            "id": str(m.get("_id", "")),
            "sender_id": sender_id,
            "sender_username": m.get("sender_username", ""),
            "message": m.get("message", ""),
            "is_admin": sender_id != ticket_user_id,
            "media_url": m.get("media_url"),
            "media_type": m.get("media_type"),
            "created_at": m.get("created_at"),
        })
    return {
        "id": str(ticket["_id"]),
        "user_id": str(ticket["user_id"]),
        "user_username": ticket.get("user_username", ""),
        "category": ticket.get("category", ""),
        "subject": ticket.get("subject", ""),
        "status": ticket.get("status", "open"),
        "assigned_admin_id": str(ticket["assigned_admin_id"]) if ticket.get("assigned_admin_id") else None,
        "assigned_admin_username": ticket.get("assigned_admin_username"),
        "messages": messages,
        "created_at": ticket.get("created_at"),
        "updated_at": ticket.get("updated_at"),
    }


def _build_ticket_summary(ticket: dict) -> dict:
    last_message = ""
    if ticket.get("messages"):
        last_message = ticket["messages"][-1].get("message", "")[:200]
    return {
        "id": str(ticket["_id"]),
        "category": ticket.get("category", ""),
        "subject": ticket.get("subject", ""),
        "status": ticket.get("status", "open"),
        "last_message_preview": last_message,
        "created_at": ticket.get("created_at"),
        "updated_at": ticket.get("updated_at"),
    }


def _clear_appeal_rate_limits(username: str) -> None:
    try:
        from app.core.database import DatabaseManager
        from app.core.background import run_in_background
        redis = DatabaseManager.get_redis()

        async def _do():
            await redis.delete(
                f"rate_limit:appeal:{username}",
                f"rate_limit:appeal_reply:{username}",
            )
            logger.info("Cleared appeal rate limits for %s", username)

        run_in_background(_do())
    except Exception:
        logger.warning("Failed to clear appeal rate limits", exc_info=True)
