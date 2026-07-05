import logging

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

    success = await ticket_repo.add_message(ticket_id, {
        "sender_id": sender_id,
        "sender_username": sender_username,
        "message": message,
    })
    if not success:
        raise NotFoundException("Ticket not found")

    updated = await ticket_repo.get_by_id(ticket_id)
    return {"data": _build_ticket_response(updated)}


async def close_ticket(ticket_id: str) -> dict:
    ticket_repo = TicketRepository()
    ticket = await ticket_repo.get_by_id(ticket_id)
    if ticket is None:
        raise NotFoundException("Ticket not found")

    if ticket.get("status") == "closed":
        raise ValidationException("Ticket is already closed")

    success = await ticket_repo.close_ticket(ticket_id)
    if not success:
        raise NotFoundException("Ticket not found")

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
            "sender_id": sender_id,
            "sender_username": m.get("sender_username", ""),
            "message": m.get("message", ""),
            "is_admin": sender_id != ticket_user_id,
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
