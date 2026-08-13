import asyncio
import logging

from app.search.config import PUBLIC_DIARIES_INDEX, get_client

logger = logging.getLogger(__name__)


async def _meili_call_retry(operation, *args, attempts: int = 3, **kwargs):
    delay = 0.5
    last_exc: Exception | None = None
    op_name = getattr(operation, "__name__", "meilisearch_op")
    for attempt in range(attempts):
        try:
            return await asyncio.to_thread(operation, *args, **kwargs)
        except Exception as e:
            last_exc = e
            logger.warning(
                "Meilisearch %s failed (attempt %d/%d): %s",
                op_name, attempt + 1, attempts, e,
            )
            if attempt < attempts - 1:
                await asyncio.sleep(delay)
                delay *= 2
    raise last_exc


class DiaryIndexer:
    def __init__(self):
        self.index = get_client().index(PUBLIC_DIARIES_INDEX)

    async def index_diary(self, diary: dict) -> None:
        if diary.get("privacy") != "public":
            return
        try:
            doc = self._build_document(diary)
            await _meili_call_retry(self.index.add_documents, [doc], primary_key="id")
        except Exception:
            logger.warning("Failed to index diary %s", diary.get("_id"), exc_info=True)

    async def remove_diary(self, diary_id: str) -> None:
        try:
            await _meili_call_retry(self.index.delete_document, diary_id)
        except Exception:
            logger.warning("Failed to remove diary %s from index", diary_id, exc_info=True)

    async def bulk_index(self, diaries: list[dict]) -> None:
        docs = [
            self._build_document(d)
            for d in diaries
            if d.get("privacy") == "public"
        ]
        if not docs:
            return
        try:
            await _meili_call_retry(self.index.add_documents, docs, primary_key="id")
        except Exception:
            logger.warning("Failed to bulk index %d diaries", len(docs), exc_info=True)

    async def clear_index(self) -> None:
        try:
            await _meili_call_retry(self.index.delete_all_documents)
        except Exception:
            logger.warning("Failed to clear Meilisearch index", exc_info=True)

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
            "created_at": _fmt_date(diary.get("created_at", "")),
            "updated_at": _fmt_date(diary.get("updated_at", "")),
            "like_count": diary.get("stats", {}).get("like_count", 0),
            "comment_count": diary.get("stats", {}).get("comment_count", 0),
            "bookmark_count": diary.get("stats", {}).get("bookmark_count", 0),
            "excerpt": content_text[:300],
            "published_at": _fmt_date(diary.get("published_at")),
        }

def _fmt_date(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
