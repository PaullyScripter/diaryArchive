from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


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
    created_at: str
    updated_at: str | None = None
