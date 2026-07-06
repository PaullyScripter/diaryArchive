import logging

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import get_current_user
from app.core.exceptions import RateLimitException
from app.core.security import check_rate_limit
from app.models.report import ReportCreate
from app.services.report_service import list_user_reports, submit_report

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


@router.post("", status_code=201)
async def create_report(
    body: ReportCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    is_limited, _ = await check_rate_limit(
        f"rate_limit:report:{current_user['_id']}", 5, 60
    )
    if is_limited:
        raise RateLimitException("Too many report submissions. Please try again later.")

    result = await submit_report(
        reporter_id=str(current_user["_id"]),
        target_type=body.target_type.value if body.target_type else "bug",
        target_id=body.target_id or "",
        reason=body.reason.value,
        description=body.description,
        url=body.url if hasattr(body, 'url') else None,
        user_agent=body.user_agent if hasattr(body, 'user_agent') else None,
    )

    return {"data": result}


@router.get("")
async def list_my_reports(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    return await list_user_reports(
        user_id=str(current_user["_id"]),
        page=page,
        per_page=per_page,
    )
