from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str


class AuthResponse(BaseModel):
    id: str
    username: str
    is_admin: bool = False
    access_token: str


class RegisterResponse(BaseModel):
    id: str
    username: str
    created_at: str
    access_token: str


class MessageResponse(BaseModel):
    message: str
