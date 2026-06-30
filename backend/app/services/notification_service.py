import asyncio
import logging
from datetime import UTC, datetime

from bson import ObjectId

from app.repositories.notification_repo import NotificationRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


def _send_notification_async(
    recipient_id: str,
    actor_id: str,
    notification_type: str,
    target_id: str | None = None,
    target_type: str | None = None,
    metadata: dict | None = None,
) -> None:
    async def _do_send():
        try:
            await create_notification(
                recipient_id=recipient_id,
                actor_id=actor_id,
                notification_type=notification_type,
                target_id=target_id,
                target_type=target_type,
                metadata=metadata,
            )
        except Exception:
            logger.warning(
                "Failed to create notification type=%s actor=%s recipient=%s",
                notification_type, actor_id, recipient_id, exc_info=True,
            )

    asyncio.create_task(_do_send())


async def create_notification(
    recipient_id: str,
    actor_id: str,
    notification_type: str,
    target_id: str | None = None,
    target_type: str | None = None,
    metadata: dict | None = None,
) -> str | None:
    if recipient_id == actor_id:
        return None

    user_repo = UserRepository()
    recipient = await user_repo.get_by_id(recipient_id)
    if recipient is None:
        return None

    prefs = recipient.get("preferences", {})
    pref_key = f"notify_on_{notification_type}"
    if not prefs.get(pref_key, True if notification_type != "bookmark" else False):
        return None

    actor = await user_repo.get_by_id(actor_id)
    actor_username = actor.get("username", "someone") if actor else "someone"

    messages = {
        "like": f"{actor_username} liked your diary",
        "comment": f"{actor_username} commented on your diary",
        "follow": f"{actor_username} started following you",
        "bookmark": f"{actor_username} bookmarked your diary",
    }
    message = messages.get(notification_type, f"{actor_username} interacted with your content")

    if metadata:
        if metadata.get("diary_title"):
            message += f' "{metadata["diary_title"][:50]}"'
        if notification_type == "comment" and metadata.get("parent_content"):
            message = f"{actor_username} replied to your comment"
            if metadata.get("diary_title"):
                message += f' on "{metadata["diary_title"][:50]}"'
        elif notification_type == "comment" and metadata.get("comment_excerpt"):
            message += f': "{metadata["comment_excerpt"][:80]}"'

    if notification_type == "follow":
        target_type = "user"
    elif notification_type == "comment":
        target_type = "comment"
    else:
        target_type = "diary"

    repo = NotificationRepository()
    doc = {
        "user_id": ObjectId(recipient_id),
        "actor_id": ObjectId(actor_id),
        "actor_username": actor_username,
        "type": notification_type,
        "target_id": ObjectId(target_id) if target_id else None,
        "target_type": target_type,
        "message": message,
        "metadata": metadata or {},
        "read": False,
        "created_at": datetime.now(UTC),
    }
    result = await repo.create(doc)
    return str(result) if result else None
