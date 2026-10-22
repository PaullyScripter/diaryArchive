from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.database import DatabaseManager

router = APIRouter(prefix="/users/me/account-standing", tags=["account-standing"])

MODERATION_ACTIONS = {
    "bio_warning",
    "username_warning",
    "ban_user",
    "unban_user",
}


def _is_future(value: datetime | None, now: datetime) -> bool:
    if value is None:
        return False
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value > now


@router.get("")
async def get_account_standing(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's current standing and permanent history."""
    db = DatabaseManager.get_db()
    user_id = str(current_user["_id"])
    now = datetime.now(UTC)

    audit_cursor = (
        db.audit_logs.find(
            {
                "target_type": "user",
                "target_id": user_id,
                "action": {"$in": sorted(MODERATION_ACTIONS)},
            },
            {
                "_id": 1,
                "action": 1,
                "admin_username": 1,
                "details": 1,
                "created_at": 1,
            },
        )
        .sort("created_at", -1)
    )
    moderation_history = []
    async for record in audit_cursor:
        moderation_history.append(
            {
                "id": str(record["_id"]),
                "action": record.get("action", ""),
                "reviewed_by": record.get("admin_username", "DiaryArchive Moderation"),
                "details": record.get("details", {}),
                "created_at": record.get("created_at"),
            }
        )

    ticket_cursor = db.tickets.find(
        {"user_id": ObjectId(user_id)},
        {
            "_id": 1,
            "category": 1,
            "subject": 1,
            "status": 1,
            "created_at": 1,
            "updated_at": 1,
        },
    ).sort("created_at", -1)
    tickets = []
    async for ticket in ticket_cursor:
        subject = ticket.get("subject", "")
        category = ticket.get("category", "")
        tickets.append(
            {
                "id": str(ticket["_id"]),
                "category": category,
                "subject": subject,
                "status": ticket.get("status", "open"),
                "is_appeal": category == "account_help" and subject.startswith("Appeal:"),
                "created_at": ticket.get("created_at"),
                "updated_at": ticket.get("updated_at"),
            }
        )

    bio_deadline = current_user.get("bio_warning_deadline")
    username_deadline = current_user.get("username_warning_deadline")
    bio_ban_until = current_user.get("bio_edit_banned_until")

    return {
        "data": {
            "standing": {
                "status": "banned" if current_user.get("is_banned") else "in_good_standing",
                "is_banned": bool(current_user.get("is_banned")),
                "ban_reason": current_user.get("ban_reason"),
                "banned_at": current_user.get("banned_at"),
                "bio_warning_count": current_user.get("bio_warning_count", 0),
                "active_warnings": {
                    "bio": {
                        "deadline": bio_deadline,
                        "reason": current_user.get("bio_warning_reason"),
                        "active": _is_future(bio_deadline, now),
                    },
                    "username": {
                        "deadline": username_deadline,
                        "reason": current_user.get("username_warning_reason"),
                        "active": _is_future(username_deadline, now),
                    },
                },
                "bio_edit_suspended_until": bio_ban_until,
                "account_created_at": current_user.get("created_at"),
            },
            "warnings": [
                item
                for item in moderation_history
                if item["action"] in {"bio_warning", "username_warning"}
            ],
            "moderation_history": moderation_history,
            "tickets": tickets,
            "appeals": [ticket for ticket in tickets if ticket["is_appeal"]],
            "history_policy": {
                "permanent": True,
                "message": (
                    "Warnings, bans, appeals, tickets, and other moderation records "
                    "remain part of your account history permanently. DiaryArchive "
                    "does not promise any time or date when past records will be "
                    "removed. A resolved or expired record is still retained."
                ),
            },
        }
    }
