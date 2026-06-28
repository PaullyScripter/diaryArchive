from datetime import datetime

from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    theme: str = "system"
    comments_disabled: bool = False
    email_notifications: bool = False
    notify_on_like: bool = True
    notify_on_comment: bool = True
    notify_on_follow: bool = True
    notify_on_bookmark: bool = False


class UserStats(BaseModel):
    diary_count: int = 0
    follower_count: int = 0
    following_count: int = 0


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    email: str | None = Field(None, max_length=254)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    avatar_path: str | None = None
    about: str | None = None
    favorite_quote: str | None = None
    currently_feeling: str | None = None
    stats: UserStats = UserStats()
    is_admin: bool = False
    created_at: datetime
    last_login_at: datetime | None = None


class UserMeResponse(UserResponse):
    has_email: bool = False
    email_verified: bool = False
    preferences: UserPreferences = UserPreferences()


class UserUpdate(BaseModel):
    avatar_path: str | None = None
    about: str | None = Field(None, max_length=500)
    favorite_quote: str | None = Field(None, max_length=300)
    currently_feeling: str | None = Field(None, max_length=50)
    preferences: UserPreferences | None = None


class UserPublicProfile(BaseModel):
    id: str
    username: str
    avatar_path: str | None = None
    about: str | None = None
    favorite_quote: str | None = None
    currently_feeling: str | None = None
    stats: UserStats = UserStats()
    created_at: datetime
    is_following: bool = False


class EmailUpdate(BaseModel):
    email: str | None = Field(None, max_length=254)


class EncryptionKeyUpdate(BaseModel):
    encrypted_master_key: str = Field(..., min_length=1)
    master_key_salt: str = Field(..., min_length=1)
