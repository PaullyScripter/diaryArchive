import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_current_admin, get_current_user
from app.core.database import DatabaseManager
from app.core.exceptions import NotFoundException, ValidationException
from app.repositories.user_repo import UserRepository
from app.services.audit_service import log_audit
from app.services.notification_service import create_notification

router = APIRouter(prefix="/admin/warnings", tags=["admin-warnings"])
user_router = APIRouter(prefix="/users/me", tags=["warnings"])

logger = logging.getLogger(__name__)

BIO_BAN_ESCALATION: dict[int, timedelta | None] = {
    3: timedelta(days=365),
    4: timedelta(days=1095),
}
BAN_PERMANENT_DATE = datetime(2099, 1, 1, tzinfo=UTC)


def _escalation_duration(bio_warning_count: int) -> timedelta | None:
    return BIO_BAN_ESCALATION.get(bio_warning_count)


@router.post("/bio")
async def issue_bio_warning(
    body: dict,
    request: Request,
    current_admin: dict = Depends(get_current_admin),
):
    user_id = body.get("user_id", "").strip()
    reason = body.get("reason", "").strip()

    if not user_id:
        raise ValidationException("user_id is required")
    if not reason or len(reason) < 5:
        raise ValidationException("reason must be at least 5 characters")

    user_repo = UserRepository()
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise NotFoundException("User not found")

    if user.get("is_admin"):
        raise ValidationException("Cannot warn an admin")

    bio_count = user.get("bio_warning_count", 0)
    new_count = bio_count + 1
    deadline = datetime.now(UTC) + timedelta(days=5)

    update_fields: dict = {
        "bio_warning_deadline": deadline,
        "bio_warning_count": new_count,
        "bio_warning_reason": reason,
    }

    if new_count >= 3:
        duration = _escalation_duration(new_count)
        if duration is not None:
            ban_until = datetime.now(UTC) + duration
        else:
            ban_until = BAN_PERMANENT_DATE
        update_fields["bio_edit_banned_until"] = ban_until
        update_fields["about"] = None

    await user_repo.update(user_id, update_fields)

    await create_notification(
        recipient_id=user_id,
        actor_id=str(current_admin["_id"]),
        notification_type="bio_warning",
        target_type="user",
        metadata={
            "title": "Bio Warning Received",
            "body": (
                f"Hello {user['username']},\n\n"
                f"Your bio has been flagged by our moderation team for the following reason:\n"
                f"\"{reason}\"\n\n"
                f"How to change your bio:\n"
                f"1. Click the notification to view details\n"
                f"2. Go to Settings > Profile\n"
                f"3. Edit the 'About' field with an appropriate bio\n"
                f"4. Click 'Save' to update your profile\n"
                f"5. Return to this notification and click 'I changed my bio'\n\n"
                f"Please update your bio within 5 days. Failure to comply may result in"
                f" your bio being blanked" +
                (" and your bio editing privileges being suspended." if new_count >= 3 else ".") +
                f"\n\nRepeated violations may result in account suspension or banning.\n\n"
                f"Regards,\nDiaryArchive Moderation"
            ),
            "count": new_count,
        },
    )

    await log_audit(
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        action="bio_warning",
        target_type="user",
        target_id=user_id,
        details={"reason": reason, "bio_warning_count": new_count, "deadline": deadline.isoformat()},
        ip_address=request.client.host if request.client else None,
    )

    return {
        "data": {
            "id": user_id,
            "username": user["username"],
            "bio_warning_count": new_count,
            "bio_warning_deadline": deadline,
            "bio_edit_banned_until": update_fields.get("bio_edit_banned_until"),
        }
    }


@router.post("/username")
async def issue_username_warning(
    body: dict,
    request: Request,
    current_admin: dict = Depends(get_current_admin),
):
    user_id = body.get("user_id", "").strip()
    reason = body.get("reason", "").strip()

    if not user_id:
        raise ValidationException("user_id is required")
    if not reason or len(reason) < 5:
        raise ValidationException("reason must be at least 5 characters")

    user_repo = UserRepository()
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise NotFoundException("User not found")

    if user.get("is_admin"):
        raise ValidationException("Cannot warn an admin")

    deadline = datetime.now(UTC) + timedelta(days=15)

    await user_repo.update(user_id, {
        "username_warning_deadline": deadline,
        "username_warning_reason": reason,
    })

    await create_notification(
        recipient_id=user_id,
        actor_id=str(current_admin["_id"]),
        notification_type="username_warning",
        target_type="user",
        metadata={
            "title": "Username Warning Received",
            "body": (
                f"Hello {user['username']},\n\n"
                f"Your username has been flagged by our moderation team for the following reason:\n"
                f"\"{reason}\"\n\n"
                f"How to change your username:\n"
                f"1. Go to Report > Open a Ticket\n"
                f"2. Select the 'Username Change' category\n"
                f"3. Set the subject to 'Username Change Request'\n"
                f"4. In the description, explain the situation and provide an appropriate new username\n"
                f"5. An admin will review your request and assist you\n\n"
                f"Please submit your username change request within 15 days. Failure to comply"
                f" may result in your account being banned.\n\n"
                f"Regards,\nDiaryArchive Moderation"
            ),
        },
    )

    await log_audit(
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
        action="username_warning",
        target_type="user",
        target_id=user_id,
        details={"reason": reason, "deadline": deadline.isoformat()},
        ip_address=request.client.host if request.client else None,
    )

    return {
        "data": {
            "id": user_id,
            "username": user["username"],
            "username_warning_deadline": deadline,
        }
    }


@router.get("")
async def list_warned_users(
    page: int = 1,
    per_page: int = 20,
    current_admin: dict = Depends(get_current_admin),
):
    skip = (page - 1) * per_page
    db = DatabaseManager.get_db()

    filter_or = []
    filter_or.append({"bio_warning_deadline": {"$exists": True}})
    filter_or.append({"username_warning_deadline": {"$exists": True}})

    cursor = db.users.find({"$or": filter_or}).skip(skip).limit(per_page)
    users = await cursor.to_list(length=per_page)
    total = await db.users.count_documents({"$or": filter_or})

    result = []
    for u in users:
        result.append({
            "id": str(u["_id"]),
            "username": u.get("username", ""),
            "bio_warning_count": u.get("bio_warning_count", 0),
            "bio_warning_deadline": u.get("bio_warning_deadline"),
            "bio_warning_reason": u.get("bio_warning_reason"),
            "bio_edit_banned_until": u.get("bio_edit_banned_until"),
            "username_warning_deadline": u.get("username_warning_deadline"),
            "username_warning_reason": u.get("username_warning_reason"),
            "is_banned": u.get("is_banned", False),
        })

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


@user_router.put("/confirm-bio-change")
async def confirm_bio_change(
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    db = DatabaseManager.get_db()

    result = await db.reports.update_many(
        {
            "target_type": "user",
            "target_id": current_user["_id"],
            "status": "pending",
        },
        {"$set": {"status": "decisiontakenbyuser"}},
    )

    user_repo = UserRepository()
    if current_user.get("bio_warning_deadline"):
        await user_repo.update(user_id, {"bio_warning_awaiting_review": True})

    return {
        "data": {
            "message": "Bio change confirmed. The moderation team will review your changes.",
            "reports_updated": result.modified_count,
        }
    }
