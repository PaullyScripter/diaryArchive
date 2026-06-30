from datetime import datetime

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: str
    type: str
    actor_username: str
    actor_avatar_path: str | None = None
    message: str
    target_id: str | None = None
    target_type: str | None = None
    read: bool = False
    created_at: str = ""
    time_ago: str = ""
    metadata: dict = Field(default_factory=dict)
