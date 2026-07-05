import logging

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import get_current_admin, get_current_user
from app.core.exceptions import RateLimitException
from app.core.security import check_rate_limit
from app.models.ticket import TicketCreate, TicketReply
from app.services.ticket_service import (
    add_message,
    assign_ticket,
    close_ticket,
    create_ticket,
    get_ticket,
    list_all_tickets,
    list_user_tickets,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])
admin_router = APIRouter(prefix="/admin/tickets", tags=["admin-tickets"])
logger = logging.getLogger(__name__)


@router.post("", status_code=201)
async def create_ticket_endpoint(
    body: TicketCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:ticket:{current_user['_id']}", 5, 3600
    )
    if is_limited:
        raise RateLimitException("Too many ticket submissions. Please try again later.")

    result = await create_ticket(
        user_id=str(current_user["_id"]),
        user_username=current_user["username"],
        category=body.category.value,
        subject=body.subject,
        description=body.description,
    )
    return {"data": result}


@router.get("")
async def list_my_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    return await list_user_tickets(
        user_id=str(current_user["_id"]),
        page=page,
        per_page=per_page,
    )


@router.get("/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await get_ticket(
        ticket_id=ticket_id,
        user_id=str(current_user["_id"]),
        is_admin=False,
    )


@router.post("/{ticket_id}/reply", status_code=201)
async def reply_to_ticket(
    ticket_id: str,
    body: TicketReply,
    current_user: dict = Depends(get_current_user),
):
    return await add_message(
        ticket_id=ticket_id,
        sender_id=str(current_user["_id"]),
        sender_username=current_user["username"],
        message=body.message,
        is_admin=False,
        media_id=body.media_id,
    )


@router.put("/{ticket_id}/close")
async def close_my_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await close_ticket(ticket_id=ticket_id, user_id=str(current_user["_id"]))


@admin_router.get("")
async def admin_list_tickets(
    status: str = Query("open", description="open, closed, all"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin),
):
    return await list_all_tickets(status=status, page=page, per_page=per_page)


@admin_router.get("/{ticket_id}")
async def admin_get_ticket(
    ticket_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    return await get_ticket(
        ticket_id=ticket_id,
        is_admin=True,
    )


@admin_router.put("/{ticket_id}/assign")
async def admin_assign_ticket(
    ticket_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    return await assign_ticket(
        ticket_id=ticket_id,
        admin_id=str(current_admin["_id"]),
        admin_username=current_admin["username"],
    )


@admin_router.post("/{ticket_id}/reply", status_code=201)
async def admin_reply_to_ticket(
    ticket_id: str,
    body: TicketReply,
    current_admin: dict = Depends(get_current_admin),
):
    return await add_message(
        ticket_id=ticket_id,
        sender_id=str(current_admin["_id"]),
        sender_username=current_admin["username"],
        message=body.message,
        is_admin=True,
        media_id=body.media_id,
    )


@admin_router.put("/{ticket_id}/close")
async def admin_close_ticket(
    ticket_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    return await close_ticket(ticket_id=ticket_id)
