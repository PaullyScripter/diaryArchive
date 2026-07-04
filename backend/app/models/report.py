from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ReportReason(str, Enum):
    spam = "spam"
    inappropriate_content = "inappropriate_content"
    harassment = "harassment"
    impersonation = "impersonation"
    copyright_violation = "copyright_violation"
    other = "other"


class ReportTargetType(str, Enum):
    diary = "diary"
    comment = "comment"
    user = "user"


class ReportStatus(str, Enum):
    pending = "pending"
    resolved = "resolved"
    dismissed = "dismissed"


class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_id: str = Field(..., min_length=1)
    reason: ReportReason
    description: str | None = Field(None, max_length=1000)


class ReportUpdate(BaseModel):
    status: ReportStatus
    resolution_note: str | None = Field(None, max_length=1000)


class ReporterInfo(BaseModel):
    id: str
    username: str


class ReportResponse(BaseModel):
    id: str
    reporter: ReporterInfo
    target_type: str
    target_id: str
    reason: str
    description: str | None = None
    status: str
    resolution_note: str | None = None
    resolved_by: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
