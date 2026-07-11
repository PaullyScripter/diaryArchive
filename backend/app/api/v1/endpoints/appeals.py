import logging

from fastapi import APIRouter, Request

from app.core.exceptions import RateLimitException, ValidationException
from app.core.security import check_rate_limit, verify_password_async
from app.repositories.ticket_repo import TicketRepository
from app.repositories.user_repo import UserRepository
from app.services.ticket_service import create_ticket

router = APIRouter(prefix="/auth", tags=["appeals"])

logger = logging.getLogger(__name__)


@router.post("/appeal/status")
async def get_appeal_status(body: dict):
    username = body.get("username", "").lower().strip()
    password = body.get("password", "")

    if not username or not password:
        raise ValidationException("username and password are required")

    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)

    if user is None or not await verify_password_async(password, user["password_hash"]):
        raise ValidationException("Invalid username or password")

    if not user.get("is_banned"):
        return {"data": {"has_appeal": False, "reason": "Account is not banned"}}

    ticket_repo = TicketRepository()
    existing = await ticket_repo.find_pending_appeal(str(user["_id"]))

    if existing:
        last_msg = ""
        if existing.get("messages"):
            last_msg = existing["messages"][-1].get("message", "")[:300]
        return {
            "data": {
                "has_appeal": True,
                "ticket_id": str(existing["_id"]),
                "status": existing.get("status", "open"),
                "subject": existing.get("subject", ""),
                "last_message_preview": last_msg,
                "created_at": existing.get("created_at"),
                "updated_at": existing.get("updated_at"),
                "assigned_admin_username": existing.get("assigned_admin_username"),
            }
        }

    return {"data": {"has_appeal": False}}


@router.post("/appeal")
async def submit_appeal(
    body: dict,
    request: Request,
):
    username = body.get("username", "").lower().strip()
    password = body.get("password", "")
    message = body.get("message", "").strip()

    if not username or not password:
        raise ValidationException("username and password are required")
    if not message or len(message) < 10:
        raise ValidationException("Appeal message must be at least 10 characters")

    is_limited, _ = await check_rate_limit(
        f"rate_limit:appeal:{request.client.host}", 3, 3600
    )
    if is_limited:
        raise RateLimitException("Too many appeal attempts. Please try again later.")

    user_repo = UserRepository()
    user = await user_repo.get_by_username(username)

    if user is None or not await verify_password_async(password, user["password_hash"]):
        raise ValidationException("Invalid username or password")

    if not user.get("is_banned"):
        raise ValidationException("Your account is not banned and cannot appeal")

    ticket_repo = TicketRepository()
    existing = await ticket_repo.find_pending_appeal(str(user["_id"]))
    if existing:
        raise ValidationException(
            "You already have a pending appeal. Please wait for a moderator to review it."
        )

    result = await create_ticket(
        user_id=str(user["_id"]),
        user_username=user["username"],
        category="account_help",
        subject=f"Appeal: {user['username']}",
        description=message,
    )

    logger.info("Ban appeal submitted: user=%s ticket=%s", username, result.get("id"))

    return {
        "data": {
            "message": "Your appeal has been submitted. The moderation team will review it.",
            "ticket_id": result.get("id"),
        }
    }
