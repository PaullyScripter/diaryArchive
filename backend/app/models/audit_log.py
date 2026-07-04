from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    admin_id: str
    admin_username: str
    action: str
    target_type: str
    target_id: str | None = None
    details: dict | None = None
    ip_address: str | None = None
    created_at: datetime
