"""Helpers that turn password-reset / email-verification tokens into emails.

These functions intentionally live outside the API layer so both the auth
endpoints and the profile/email endpoints share one code path.
"""

import logging

from app.core.config import settings
from app.services.email_service import email_service
from app.services.encryption_service import decrypt_email

logger = logging.getLogger(__name__)


def _public_base() -> str:
    return settings.public_app_url.rstrip("/")


def _decrypt_user_email(user: dict) -> str | None:
    encrypted = user.get("email_encrypted")
    if not encrypted:
        return None
    try:
        return decrypt_email(encrypted)
    except Exception:
        logger.exception("Failed to decrypt user email for user %s", user.get("_id"))
        return None


async def send_password_reset_email(user: dict, token_raw: str) -> bool:
    """Email a single-use password-reset link to the user's verified/encrypted address."""
    email = _decrypt_user_email(user)
    if not email:
        logger.warning(
            "Password reset requested for user %s but no decryptable email is stored",
            user.get("_id"),
        )
        return False
    username = user.get("username", "user")
    url = f"{_public_base()}/reset-password?token={token_raw}"
    subject = "Reset your DiaryArchive password"
    body = (
        f"Hello {username},\n\n"
        "A password reset was requested for your DiaryArchive account. "
        "If this was you, open the link below to choose a new password:\n\n"
        f"{url}\n\n"
        "This link expires in 1 hour and can only be used once.\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "— DiaryArchive"
    )
    return await email_service.send_email(email, subject, body)


async def send_email_verification(user: dict, token_raw: str) -> bool:
    """Email a single-use link that marks the account's email as verified."""
    email = _decrypt_user_email(user)
    if not email:
        logger.warning(
            "Verification requested for user %s but no decryptable email is stored",
            user.get("_id"),
        )
        return False
    username = user.get("username", "user")
    url = f"{_public_base()}/verify-email?token={token_raw}"
    subject = "Verify your DiaryArchive email"
    body = (
        f"Hello {username},\n\n"
        "Confirm this email address for your DiaryArchive account by opening "
        "the link below:\n\n"
        f"{url}\n\n"
        "This link expires in 1 hour and can only be used once.\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "— DiaryArchive"
    )
    return await email_service.send_email(email, subject, body)