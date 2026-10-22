import logging
from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.core.database import DatabaseManager
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.user_repo import UserRepository
from app.services.audit_service import log_audit
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)


async def check_bio_warnings() -> int:
    db = DatabaseManager.get_db()
    now = datetime.now(UTC)

    count = 0
    user_repo = UserRepository()
    cursor = db.users.find({"bio_warning_deadline": {"$lte": now}})
    async for user in cursor:
        user_id = str(user["_id"])
        claimed = await db.users.update_one(
            {
                "_id": user["_id"],
                "bio_warning_deadline": user.get("bio_warning_deadline"),
                "$or": [
                    {"warning_processing_at": {"$exists": False}},
                    {"warning_processing_at": None},
                    {"warning_processing_at": {"$lte": now - timedelta(minutes=10)}},
                ],
            },
            {"$set": {"warning_processing_at": now}},
        )
        if claimed.modified_count != 1:
            continue
        snapshot = user.get("bio_warning_about_snapshot")
        current_about = user.get("about")
        # Only blank the bio if it is still (or again) the exact offending
        # snapshot — i.e. the user did not actually comply. If it differs, the
        # user has genuinely changed their bio, so we clear the pending warning
        # state instead of punishing a compliant user.
        if current_about == snapshot:
            await user_repo.update(
                user_id,
                {
                    "about": None,
                    "bio_warning_deadline": None,
                    "warning_processing_at": None,
                },
            )
            await create_notification(
                recipient_id=user_id,
                actor_id=user_id,
                notification_type="bio_warning",
                target_type="user",
                metadata={
                    "title": "Bio Removed After Warning",
                    "body": (
                        "Your bio was removed because it was not changed before "
                        "the warning deadline."
                    ),
                },
            )
            count += 1
            logger.info(
                "Bio auto-blanked for user %s (deadline: %s)",
                user.get("username", user_id),
                user.get("bio_warning_deadline"),
            )
        else:
            await user_repo.update(
                user_id,
                {
                    "bio_warning_deadline": None,
                    "bio_warning_about_snapshot": None,
                    "warning_processing_at": None,
                },
            )
            logger.info(
                "Bio warning cleared for user %s (bio changed after warning)",
                user.get("username", user_id),
            )

    ban_removed = 0
    expired_bans = db.users.find(
        {"bio_edit_banned_until": {"$lte": now, "$ne": None}}
    )
    async for user in expired_bans:
        user_id = str(user["_id"])
        await user_repo.update(
            user_id,
            {
                "bio_edit_banned_until": None,
                "bio_warning_awaiting_review": None,
                "warning_processing_at": None,
            },
        )
        ban_removed += 1
        logger.info(
            "Bio edit ban expired for user %s",
            user.get("username", user_id),
        )

    return count + ban_removed


async def check_username_warnings() -> int:
    db = DatabaseManager.get_db()
    now = datetime.now(UTC)

    count = 0
    user_repo = UserRepository()
    cursor = db.users.find(
        {"username_warning_deadline": {"$lte": now}, "is_banned": {"$ne": True}}
    )
    async for user in cursor:
        user_id = str(user["_id"])
        claimed = await db.users.update_one(
            {
                "_id": user["_id"],
                "username_warning_deadline": user.get("username_warning_deadline"),
                "is_banned": {"$ne": True},
                "$or": [
                    {"warning_processing_at": {"$exists": False}},
                    {"warning_processing_at": None},
                    {"warning_processing_at": {"$lte": now - timedelta(minutes=10)}},
                ],
            },
            {"$set": {"warning_processing_at": now}},
        )
        if claimed.modified_count != 1:
            continue
        reason = user.get("username_warning_reason", "Username policy violation")

        ban_reason = f"Username warning expired: {reason}"
        await user_repo.set_ban_status(user_id, True, ban_reason=ban_reason)
        await user_repo.update(user_id, {"warning_processing_at": None})
        await RefreshTokenRepository().delete_all_for_user(user_id)
        await user_repo.refresh_banned_user_ids()
        await log_audit(
            admin_id="system",
            admin_username="DiaryArchive Moderation",
            action="ban_user",
            target_type="user",
            target_id=user_id,
            details={"reason": ban_reason, "source": "expired_username_warning"},
        )
        _remove_user_from_search(user_id)

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


def _remove_user_from_search(user_id: str) -> None:
    try:
        from app.core.background import run_in_background
        from app.search.indexer import DiaryIndexer

        db = DatabaseManager.get_db()
        indexer = DiaryIndexer()

        async def _remove():
            cursor = db.diaries.find({"user_id": ObjectId(user_id), "privacy": "public"})
            async for diary in cursor:
                await indexer.remove_diary(str(diary["_id"]))

        run_in_background(_remove())
    except Exception:
        logger.warning("Failed to remove automatically banned user from search", exc_info=True)
