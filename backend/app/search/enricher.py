import logging

from app.repositories.bookmark_repo import BookmarkRepository
from app.repositories.like_repo import LikeRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


async def enrich_search_results(
    hits: list[dict],
    current_user: dict | None = None,
) -> list[dict]:
    if not hits:
        return []

    author_ids = list({h["author_id"] for h in hits if h.get("author_id")})
    user_repo = UserRepository()
    authors = await user_repo.find_by_ids(author_ids) if author_ids else []
    author_map = {str(a["_id"]): a for a in authors}

    liked_ids: set[str] = set()
    bookmarked_ids: set[str] = set()
    if current_user:
        like_repo = LikeRepository()
        bookmark_repo = BookmarkRepository()
        diary_ids = [h["id"] for h in hits]
        like_docs = await like_repo.find_by_user_and_diary_ids(
            str(current_user["_id"]), diary_ids
        )
        liked_ids = {str(d["diary_id"]) for d in like_docs}
        bookmark_docs = await bookmark_repo.find_by_user_and_diary_ids(
            str(current_user["_id"]), diary_ids
        )
        bookmarked_ids = {str(d["diary_id"]) for d in bookmark_docs}

    enriched = []
    for hit in hits:
        author = author_map.get(hit.get("author_id", ""), {})
        if author.get("is_banned"):
            continue
        formatted = hit.get("_formatted", {})
        entry = {
            "id": hit["id"],
            "title": formatted.get("title", hit.get("title", "")),
            "excerpt": formatted.get("content_text", hit.get("excerpt", "")),
            "content_html": hit.get("content_html", ""),
            "tags": hit.get("tags", []),
            "emotion": hit.get("emotion"),
            "author": {
                "id": hit.get("author_id", ""),
                "username": author.get("username", "unknown"),
                "avatar_path": author.get("avatar_path"),
            },
            "stats": {
                "like_count": hit.get("like_count", 0),
                "comment_count": hit.get("comment_count", 0),
                "bookmark_count": hit.get("bookmark_count", 0),
            },
            "created_at": hit.get("created_at", ""),
            "highlights": {
                "title": formatted.get("title", hit.get("title", "")),
                "content_text": formatted.get("content_text", hit.get("excerpt", "")),
            },
        }
        if current_user:
            entry["is_liked"] = hit["id"] in liked_ids
            entry["is_bookmarked"] = hit["id"] in bookmarked_ids
            entry["is_owner"] = str(author.get("_id", "")) == str(current_user["_id"])
        else:
            entry["is_liked"] = False
            entry["is_bookmarked"] = False
            entry["is_owner"] = False
        enriched.append(entry)

    return enriched
