from datetime import datetime

from pydantic import BaseModel, Field


VALID_EMOTIONS = frozenset({
    "happy", "sad", "anxious", "angry", "excited", "grateful",
    "lonely", "hopeful", "nostalgic", "reflective", "neutral",
})


class DiaryCreate(BaseModel):
    privacy: str = Field(default="public", pattern=r"^(public|draft)$")
    title: str | None = Field(None, max_length=200)
    content_html: str | None = Field(None, max_length=102400)
    content_text: str | None = Field(None, max_length=51200)
    tags: list[str] = Field(default_factory=list, max_length=10)
    emotion: str | None = None
    comments_enabled: bool = True


class DiaryUpdate(BaseModel):
    privacy: str | None = None
    title: str | None = Field(None, max_length=200)
    content_html: str | None = Field(None, max_length=102400)
    content_text: str | None = Field(None, max_length=51200)
    tags: list[str] | None = None
    emotion: str | None = None
    comments_enabled: bool | None = None


class DiaryStats(BaseModel):
    like_count: int = 0
    comment_count: int = 0
    bookmark_count: int = 0


class AuthorInfo(BaseModel):
    id: str
    username: str
    avatar_path: str | None = None


class DiaryResponse(BaseModel):
    id: str
    privacy: str
    title: str | None = None
    content_html: str | None = None
    content_text: str | None = None
    author: AuthorInfo
    tags: list[str] = []
    emotion: str | None = None
    comments_enabled: bool = True
    comments_locked: bool = False
    stats: DiaryStats = DiaryStats()
    is_liked: bool = False
    is_bookmarked: bool = False
    is_owner: bool = False
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None


class DiaryListItem(BaseModel):
    id: str
    title: str | None = None
    excerpt: str | None = None
    author: AuthorInfo
    tags: list[str] = []
    emotion: str | None = None
    stats: DiaryStats = DiaryStats()
    is_liked: bool = False
    is_bookmarked: bool = False
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None
