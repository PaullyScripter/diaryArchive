from pydantic import BaseModel, Field


class WarningCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    reason: str = Field(..., min_length=5, max_length=1000)


class TicketResolution(BaseModel):
    action: str = Field(..., pattern=r"^(accept|deny)$")
    response_message: str = Field(..., min_length=10, max_length=2000)


class AppealCredentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=1, max_length=128)


class AppealSubmit(AppealCredentials):
    message: str = Field(..., min_length=10, max_length=4000)


class AppealReply(AppealCredentials):
    message: str = Field(..., min_length=5, max_length=4000)
