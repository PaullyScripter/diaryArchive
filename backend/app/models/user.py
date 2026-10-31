from datetime import datetime

from pydantic import BaseModel, Field, model_validator


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
    accepted_terms: bool = Field(
        default=False,
        description="User confirms they have read and agree to the Terms of Service",
    )


class UserLogin(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
    new_encrypted_master_key: str | None = Field(
        None, min_length=96, max_length=250_000, pattern=r"^[0-9a-fA-F]+$"
    )
    new_master_key_salt: str | None = Field(
        None, min_length=32, max_length=32, pattern=r"^[0-9a-fA-F]{32}$"
    )
    new_master_key_iv: str | None = Field(
        None, min_length=24, max_length=24, pattern=r"^[0-9a-fA-F]{24}$"
    )

    @model_validator(mode="after")
    def validate_master_key_fields(self):
        fields = (
            self.new_encrypted_master_key,
            self.new_master_key_salt,
            self.new_master_key_iv,
        )
        if any(value is not None for value in fields) and not all(
            value is not None for value in fields
        ):
            raise ValueError("All new master-key fields must be provided together")
        return self


class PasswordResetRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)


class PasswordResetSubmit(BaseModel):
    token: str = Field(..., min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    new_password: str = Field(..., min_length=8, max_length=128)


class EmailVerificationRequest(BaseModel):
    token: str = Field(..., min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")


class PasswordConfirmation(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


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
    about: str | None = Field(None, max_length=500)
    favorite_quote: str | None = Field(None, max_length=300)
    currently_feeling: str | None = Field(None, max_length=50)
    preferences: UserPreferences | None = None


class UsernameUpdate(BaseModel):
    username: str = Field(..., min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_-]+$")


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
    encrypted_master_key: str = Field(
        ..., min_length=96, max_length=256, pattern=r"^[0-9a-fA-F]+$"
    )
    master_key_salt: str = Field(..., min_length=32, max_length=32, pattern=r"^[0-9a-fA-F]{32}$")
    master_key_iv: str = Field(..., min_length=24, max_length=24, pattern=r"^[0-9a-fA-F]{24}$")
