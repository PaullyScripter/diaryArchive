from app.schemas.audit_log import audit_log_indexes
from app.schemas.bookmark import bookmark_indexes
from app.schemas.comment import comment_indexes, comment_like_indexes
from app.schemas.diary import diary_indexes
from app.schemas.follow import follow_indexes
from app.schemas.like import like_indexes
from app.schemas.media import media_indexes
from app.schemas.notification import notification_indexes
from app.schemas.password_reset_token import password_reset_token_indexes
from app.schemas.refresh_token import refresh_token_indexes
from app.schemas.report import report_indexes
from app.schemas.user import user_indexes

ALL_INDEXES: dict[str, list[tuple[dict, dict]]] = {
    "users": user_indexes,
    "diaries": diary_indexes,
    "comments": comment_indexes,
    "comment_likes": comment_like_indexes,
    "likes": like_indexes,
    "bookmarks": bookmark_indexes,
    "follows": follow_indexes,
    "notifications": notification_indexes,
    "reports": report_indexes,
    "audit_logs": audit_log_indexes,
    "media": media_indexes,
    "refresh_tokens": refresh_token_indexes,
    "password_reset_tokens": password_reset_token_indexes,
}
