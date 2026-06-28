import logging

from app.search.config import PUBLIC_DIARIES_INDEX, get_client

logger = logging.getLogger(__name__)


class DiaryIndexer:
    def __init__(self):
        self.index = get_client().index(PUBLIC_DIARIES_INDEX)

    async def index_diary(self, diary: dict) -> None:
        if diary.get("privacy") != "public":
            return
        try:
            doc = self._build_document(diary)
            await self.index.add_documents([doc], primary_key="id")
        except Exception:
            logger.warning("Failed to index diary %s", diary.get("_id"))

    async def remove_diary(self, diary_id: str) -> None:
        try:
            await self.index.delete_document(diary_id)
        except Exception:
            logger.warning("Failed to remove diary %s from index", diary_id)

    async def bulk_index(self, diaries: list[dict]) -> None:
        docs = [
            self._build_document(d)
            for d in diaries
            if d.get("privacy") == "public"
        ]
        if not docs:
            return
        try:
            await self.index.add_documents(docs, primary_key="id")
        except Exception:
            logger.warning("Failed to bulk index %d diaries", len(docs))

    async def clear_index(self) -> None:
        try:
            await self.index.delete_all_documents()
        except Exception:
            logger.warning("Failed to clear Meilisearch index")

    def _build_document(self, diary: dict) -> dict:
        content_text = diary.get("content_text") or ""
        return {
            "id": str(diary["_id"]),
            "title": diary.get("title") or "",
            "content_text": content_text,
            "content_html": diary.get("content_html") or "",
            "tags": diary.get("tags", []),
            "emotion": diary.get("emotion"),
            "year": diary.get("year"),
            "month": diary.get("month"),
            "author_id": str(diary["user_id"]),
            "created_at": diary["created_at"].isoformat() if hasattr(diary["created_at"], "isoformat") else str(diary["created_at"]),
            "updated_at": diary["updated_at"].isoformat() if diary.get("updated_at") and hasattr(diary["updated_at"], "isoformat") else str(diary.get("updated_at", "")),
            "like_count": diary.get("stats", {}).get("like_count", 0),
            "comment_count": diary.get("stats", {}).get("comment_count", 0),
            "bookmark_count": diary.get("stats", {}).get("bookmark_count", 0),
            "excerpt": content_text[:300],
            "published_at": diary.get("published_at").isoformat() if diary.get("published_at") and hasattr(diary["published_at"], "isoformat") else None,
        }
