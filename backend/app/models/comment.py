from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: str | None = None


class CommentAuthor(BaseModel):
    id: str
    username: str
    avatar_path: str | None = None


class CommentResponse(BaseModel):
    id: str
    content: str | None = None
    author: CommentAuthor
    is_deleted: bool = False
    is_owner: bool = False
    is_diary_owner: bool = False
    parent_comment_id: str | None = None
    depth: int = 0
    reply_count: int = 0
    like_count: int = 0
    is_liked: bool = False
    created_at: str
    updated_at: str | None = None
