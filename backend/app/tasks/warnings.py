import logging
from datetime import UTC, datetime

from app.core.database import DatabaseManager
from app.repositories.user_repo import UserRepository
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)


async def check_bio_warnings() -> int:
    db = DatabaseManager.get_db()
    now = datetime.now(UTC)

    expired = await db.users.find({
        "bio_warning_deadline": {"$lte": now},
    }).to_list(length=1000)

    count = 0
    user_repo = UserRepository()
    for user in expired:
        user_id = str(user["_id"])
        snapshot = user.get("bio_warning_about_snapshot")
        current_about = user.get("about")
        # Only blank the bio if it is still (or again) the exact offending
        # snapshot — i.e. the user did not actually comply. If it differs, the
        # user has genuinely changed their bio, so we clear the pending warning
        # state instead of punishing a compliant user.
        if current_about == snapshot:
            await user_repo.update(user_id, {"about": None})
            count += 1
            logger.info(
                "Bio auto-blanked for user %s (deadline: %s)",
                user.get("username", user_id), user.get("bio_warning_deadline"),
            )
        else:
            await user_repo.update(user_id, {
                "bio_warning_deadline": None,
                "bio_warning_about_snapshot": None,
            })
            logger.info(
                "Bio warning cleared for user %s (bio changed after warning)",
                user.get("username", user_id),
            )

    expired_bans = await db.users.find({
        "bio_edit_banned_until": {"$lte": now, "$ne": None},
    }).to_list(length=1000)

    ban_removed = 0
    for user in expired_bans:
        user_id = str(user["_id"])
        await user_repo.update(user_id, {
            "bio_edit_banned_until": None,
            "bio_warning_awaiting_review": None,
        })
        ban_removed += 1
        logger.info(
            "Bio edit ban expired for user %s",
            user.get("username", user_id),
        )

    return count + ban_removed


async def check_username_warnings() -> int:
    db = DatabaseManager.get_db()
    now = datetime.now(UTC)

    expired = await db.users.find({
        "username_warning_deadline": {"$lte": now},
        "is_banned": {"$ne": True},
    }).to_list(length=1000)

    count = 0
    user_repo = UserRepository()
    for user in expired:
        user_id = str(user["_id"])
        reason = user.get("username_warning_reason", "Username policy violation")

        await user_repo.update(user_id, {
            "is_banned": True,
            "ban_reason": f"Username warning expired: {reason}",
            "banned_at": now,
        })

        await create_notification(
            recipient_id=user_id,
            actor_id=user_id,
            notification_type="username_warning",
            target_type="user",
            metadata={
                "title": "Account Banned - Username Warning",
                "body": (
                    f"Your account has been banned because you did not change your username"
                    f" within the required time period.\n\n"
                    f"Reason: {reason}\n\n"
                    f"You may submit an appeal through the login page.\n\n"
                    f"Regards,\nDiaryArchive Moderation"
                ),
            },
        )

        count += 1
        logger.info(
            "User %s banned for expired username warning",
            user.get("username", user_id),
        )

    return count
