from pydantic import BaseModel


class ToggleResponse(BaseModel):
    is_liked: bool | None = None
    is_bookmarked: bool | None = None
    is_following: bool | None = None
    like_count: int | None = None
    bookmark_count: int | None = None
    follower_count: int | None = None


class UserListItem(BaseModel):
    id: str
    username: str
    avatar_path: str | None = None
    about: str | None = None
    is_following: bool = False
