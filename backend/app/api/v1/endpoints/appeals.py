import logging

from fastapi import APIRouter, Request

from app.core.exceptions import RateLimitException, ValidationException
from app.core.security import check_rate_limit, verify_password_async
from app.repositories.user_repo import UserRepository
from app.services.ticket_service import create_ticket

router = APIRouter(prefix="/auth", tags=["appeals"])

logger = logging.getLogger(__name__)


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
