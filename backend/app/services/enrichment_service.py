from app.repositories.bookmark_repo import BookmarkRepository
from app.repositories.like_repo import LikeRepository


async def enrich_diary_batch(
    diaries: list[dict],
    current_user: dict | None = None,
) -> list[dict]:
    if not current_user:
        for d in diaries:
            d["is_liked"] = False
            d["is_bookmarked"] = False
            d["is_owner"] = False
        return diaries

    user_id = str(current_user["_id"])
    diary_ids = [str(d["_id"]) for d in diaries]

    like_repo = LikeRepository()
    like_docs = await like_repo.find_by_user_and_diary_ids(user_id, diary_ids)
    liked_ids = {str(d["diary_id"]) for d in like_docs}

    bookmark_repo = BookmarkRepository()
    bookmark_docs = await bookmark_repo.find_by_user_and_diary_ids(user_id, diary_ids)
    bookmarked_ids = {str(d["diary_id"]) for d in bookmark_docs}

    for d in diaries:
        did = str(d["_id"])
        d["is_liked"] = did in liked_ids
        d["is_bookmarked"] = did in bookmarked_ids
        d["is_owner"] = str(d.get("user_id", "")) == user_id

    return diaries
