from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TicketCategory(str, Enum):
    account_help = "account_help"
    username_change = "username_change"
    general_inquiry = "general_inquiry"
    feature_request = "feature_request"
    report_problem = "report_problem"


class TicketCreate(BaseModel):
    category: TicketCategory
    subject: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)


class TicketReply(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    media_id: str | None = Field(None, min_length=1)


class TicketMessage(BaseModel):
    sender_id: str
    sender_username: str
    message: str
    created_at: datetime


class TicketResponse(BaseModel):
    id: str
    user_id: str
    user_username: str
    category: str
    subject: str
    status: str
    assigned_admin_id: str | None = None
    assigned_admin_username: str | None = None
    messages: list[TicketMessage] = []
    created_at: datetime
    updated_at: datetime
